import {
  AnalyzeInput,
  HintResult,
  ExplainResult,
  SYSTEM_PROMPT,
  EXPLAIN_PROMPT,
  VlmProvider,
  formatUserText,
  parseHintJson,
  parseExplainJson,
} from './types';

// Plain fetch — no extra SDK dependency. Targets any OpenAI-compatible
// chat-completions endpoint: OpenAI, Azure OpenAI, OpenRouter, Groq, Together,
// Ollama (/v1), LM Studio, vLLM, llama.cpp server, Google Gemini's OpenAI-compat
// endpoint, etc. Server-specific quirks (e.g. some servers ignore
// response_format) are tolerated: we parse JSON from the assistant text.

export interface OpenAIProviderOptions {
  apiKey: string;
  model: string;
  baseURL: string; // e.g. https://api.openai.com/v1 or http://localhost:11434/v1
}

export class OpenAIProvider implements VlmProvider {
  private apiKey: string;
  private model: string;
  private baseURL: string;

  constructor(opts: OpenAIProviderOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    // Strip trailing slash so we can append /chat/completions safely.
    this.baseURL = opts.baseURL.replace(/\/+$/, '');
  }

  async analyze(input: AnalyzeInput): Promise<HintResult | null> {
    const dataUrl = `data:image/png;base64,${input.pngBuffer.toString('base64')}`;
    const body = {
      model: this.model,
      max_tokens: 400,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: formatUserText(input, input.aggressiveness) },
          ],
        },
      ],
    };

    try {
      const res = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await safeText(res);
        console.warn(`OpenAI provider HTTP ${res.status}: ${detail.slice(0, 200)}`);
        return null;
      }
      const json: any = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.length === 0) return null;
      return parseHintJson(content);
    } catch (e: any) {
      console.warn('OpenAIProvider error:', e?.message ?? e);
      return null;
    }
  }

  async explain(input: Omit<AnalyzeInput, 'userRequested' | 'idleMs' | 'aggressiveness'>): Promise<ExplainResult | null> {
    const dataUrl = `data:image/png;base64,${input.pngBuffer.toString('base64')}`;
    const body = {
      model: this.model,
      max_tokens: 300,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXPLAIN_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: `Cursor at (${input.cursorX}, ${input.cursorY}) on a ${input.screenWidth}×${input.screenHeight} screen. Explain what's near the cursor.` },
          ],
        },
      ],
    };
    try {
      const res = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const json: any = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') return null;
      return parseExplainJson(content);
    } catch (e: any) {
      console.warn('OpenAIProvider explain error:', e?.message ?? e);
      return null;
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

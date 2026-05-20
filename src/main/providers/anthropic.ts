import Anthropic from '@anthropic-ai/sdk';
import {
  AnalyzeInput,
  HintResult,
  ExplainResult,
  SCHEMA,
  SYSTEM_PROMPT,
  EXPLAIN_PROMPT,
  VlmProvider,
  formatUserText,
  parseHintJson,
  parseExplainJson,
} from './types';

export interface AnthropicProviderOptions {
  apiKey?: string;       // x-api-key header (real Anthropic API)
  authToken?: string;    // Authorization: Bearer header (proxies / claude-code-router style setups)
  model: string;
  baseURL?: string;      // override https://api.anthropic.com
}

export class AnthropicProvider implements VlmProvider {
  private client: Anthropic;
  private model: string;

  constructor(opts: AnthropicProviderOptions) {
    // Only forward fields that are actually set. The SDK falls back to the
    // ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL env vars
    // for any field we omit — useful for proxy/router setups.
    const sdkOpts: Record<string, string> = {};
    if (opts.apiKey) sdkOpts.apiKey = opts.apiKey;
    if (opts.authToken) sdkOpts.authToken = opts.authToken;
    if (opts.baseURL) sdkOpts.baseURL = opts.baseURL;
    this.client = new Anthropic(sdkOpts as any);
    this.model = opts.model;
  }

  async analyze(input: AnalyzeInput): Promise<HintResult | null> {
    const b64 = input.pngBuffer.toString('base64');
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 400,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: b64 },
              },
              { type: 'text', text: formatUserText(input, input.aggressiveness) },
            ],
          },
        ],
        output_config: {
          format: { type: 'json_schema', schema: SCHEMA as any },
        },
      } as any);

      const text = response.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');
      if (!text) return null;
      return parseHintJson(text);
    } catch (e: any) {
      if (e instanceof Anthropic.APIError) {
        console.warn(`Anthropic API error (${e.status}): ${e.message}`);
      } else {
        console.warn('AnthropicProvider error:', e?.message ?? e);
      }
      return null;
    }
  }

  async explain(input: Omit<AnalyzeInput, 'userRequested' | 'idleMs' | 'aggressiveness'>): Promise<ExplainResult | null> {
    const b64 = input.pngBuffer.toString('base64');
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 300,
        system: EXPLAIN_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
              { type: 'text', text: `Cursor at (${input.cursorX}, ${input.cursorY}) on a ${input.screenWidth}×${input.screenHeight} screen. Explain what's near the cursor.` },
            ],
          },
        ],
      } as any);
      const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
      if (!text) return null;
      return parseExplainJson(text);
    } catch (e: any) {
      console.warn('Explain error:', e?.message ?? e);
      return null;
    }
  }
}

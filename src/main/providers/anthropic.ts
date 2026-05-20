import Anthropic from '@anthropic-ai/sdk';
import {
  AnalyzeInput,
  HintResult,
  SCHEMA,
  SYSTEM_PROMPT,
  VlmProvider,
  formatUserText,
  parseHintJson,
} from './types';

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  baseURL?: string;
}

export class AnthropicProvider implements VlmProvider {
  private client: Anthropic;
  private model: string;

  constructor(opts: AnthropicProviderOptions) {
    this.client = new Anthropic({
      apiKey: opts.apiKey,
      ...(opts.baseURL ? { baseURL: opts.baseURL } : {}),
    });
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
              { type: 'text', text: formatUserText(input) },
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
}

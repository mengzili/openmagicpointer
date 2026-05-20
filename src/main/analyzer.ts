import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';
import { AnalyzeInput, HintResult, VlmProvider } from './providers/types';

export type { AnalyzeInput, HintResult } from './providers/types';

export type ProviderId = 'anthropic' | 'openai';

export interface AnalyzerOptions {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseURL?: string;
}

export class Analyzer {
  private impl: VlmProvider;

  constructor(opts: AnalyzerOptions) {
    if (opts.provider === 'openai') {
      this.impl = new OpenAIProvider({
        apiKey: opts.apiKey,
        model: opts.model,
        baseURL: opts.baseURL || 'https://api.openai.com/v1',
      });
    } else {
      this.impl = new AnthropicProvider({
        apiKey: opts.apiKey,
        model: opts.model,
        baseURL: opts.baseURL || undefined,
      });
    }
  }

  analyze(input: AnalyzeInput): Promise<HintResult | null> {
    return this.impl.analyze(input);
  }
}

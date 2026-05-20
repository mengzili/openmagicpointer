import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';
import { AnalyzeInput, HintResult, ExplainResult, VlmProvider, EXPLAIN_PROMPT, parseExplainJson } from './providers/types';

export type { AnalyzeInput, HintResult, ExplainResult } from './providers/types';

export type ProviderId = 'anthropic' | 'openai';

export interface AnalyzerOptions {
  provider: ProviderId;
  apiKey: string;
  authToken?: string;
  model: string;
  baseURL?: string;
}

export class Analyzer {
  private impl: VlmProvider;

  constructor(opts: AnalyzerOptions) {
    if (opts.provider === 'openai') {
      this.impl = new OpenAIProvider({
        apiKey: opts.apiKey || opts.authToken || '',
        model: opts.model,
        baseURL: opts.baseURL || 'https://api.openai.com/v1',
      });
    } else {
      this.impl = new AnthropicProvider({
        apiKey: opts.apiKey || undefined,
        authToken: opts.authToken || undefined,
        model: opts.model,
        baseURL: opts.baseURL || undefined,
      });
    }
  }

  analyze(input: AnalyzeInput): Promise<HintResult | null> {
    return this.impl.analyze(input);
  }

  async explain(input: Omit<AnalyzeInput, 'userRequested' | 'idleMs' | 'aggressiveness'>): Promise<ExplainResult | null> {
    // Reuse the provider's analyze path but with the explain prompt.
    // We do this by calling analyze with a special flag — but simpler to just
    // call the provider directly with a modified input that triggers explain mode.
    // For now, use a lightweight approach: call analyze with explain-specific text.
    return this.impl.explain?.(input) ?? null;
  }
}

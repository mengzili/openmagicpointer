import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Analyzer } from '../../src/main/analyzer';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]);

function input(overrides: Partial<Parameters<Analyzer['analyze']>[0]> = {}) {
  return {
    pngBuffer: PNG,
    cursorX: 0,
    cursorY: 0,
    screenWidth: 1280,
    screenHeight: 720,
    idleMs: 7000,
    userRequested: false,
    ...overrides,
  };
}

function fakeJsonResponse(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function chatCompletionsBody(jsonText: string) {
  return {
    id: 'chatcmpl-test',
    choices: [{ index: 0, message: { role: 'assistant', content: jsonText }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
  };
}

describe('OpenAIProvider (via Analyzer)', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('POSTs to {baseURL}/chat/completions with the configured model and bearer token', async () => {
    fetchMock.mockResolvedValue(
      fakeJsonResponse(
        chatCompletionsBody(
          JSON.stringify({ needs_hint: false, hint: '', confidence: 'low', reason: 'x' }),
        ),
      ),
    );
    const a = new Analyzer({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      baseURL: 'https://api.openai.com/v1',
    });
    await a.analyze(input());
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-test');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.response_format).toEqual({ type: 'json_object' });
    const userMsg = body.messages.find((m: any) => m.role === 'user');
    const image = userMsg.content.find((c: any) => c.type === 'image_url');
    expect(image.image_url.url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('omits Authorization when no key is configured (local Ollama-style server)', async () => {
    fetchMock.mockResolvedValue(
      fakeJsonResponse(
        chatCompletionsBody(
          JSON.stringify({ needs_hint: false, hint: '', confidence: 'low', reason: 'x' }),
        ),
      ),
    );
    const a = new Analyzer({
      provider: 'openai',
      apiKey: '',
      model: 'llava',
      baseURL: 'http://localhost:11434/v1',
    });
    await a.analyze(input());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('strips a trailing slash from baseURL', async () => {
    fetchMock.mockResolvedValue(
      fakeJsonResponse(
        chatCompletionsBody(
          JSON.stringify({ needs_hint: true, hint: 'h', confidence: 'high', reason: 'r' }),
        ),
      ),
    );
    const a = new Analyzer({
      provider: 'openai',
      apiKey: 'sk',
      model: 'm',
      baseURL: 'https://example.com/v1/',
    });
    await a.analyze(input());
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/v1/chat/completions');
  });

  it('parses a normal JSON response', async () => {
    fetchMock.mockResolvedValue(
      fakeJsonResponse(
        chatCompletionsBody(
          JSON.stringify({
            needs_hint: true,
            hint: 'Press Enter to confirm.',
            confidence: 'high',
            reason: 'modal confirm',
          }),
        ),
      ),
    );
    const a = new Analyzer({
      provider: 'openai',
      apiKey: 'sk',
      model: 'm',
      baseURL: 'https://api.openai.com/v1',
    });
    const result = await a.analyze(input());
    expect(result).not.toBeNull();
    expect(result!.needsHint).toBe(true);
    expect(result!.hint).toBe('Press Enter to confirm.');
  });

  it('parses JSON even when the server wraps it in ```json fences', async () => {
    fetchMock.mockResolvedValue(
      fakeJsonResponse(
        chatCompletionsBody(
          '```json\n' +
            JSON.stringify({ needs_hint: false, hint: '', confidence: 'low', reason: 'fenced' }) +
            '\n```',
        ),
      ),
    );
    const a = new Analyzer({
      provider: 'openai',
      apiKey: 'sk',
      model: 'm',
      baseURL: 'https://api.openai.com/v1',
    });
    const result = await a.analyze(input());
    expect(result).not.toBeNull();
    expect(result!.needsHint).toBe(false);
    expect(result!.reason).toBe('fenced');
  });

  it('returns null on HTTP error', async () => {
    fetchMock.mockResolvedValue(fakeJsonResponse({ error: 'rate limit' }, false, 429));
    const a = new Analyzer({
      provider: 'openai',
      apiKey: 'sk',
      model: 'm',
      baseURL: 'https://api.openai.com/v1',
    });
    const result = await a.analyze(input());
    expect(result).toBeNull();
  });

  it('returns null when fetch itself throws (network down)', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const a = new Analyzer({
      provider: 'openai',
      apiKey: 'sk',
      model: 'm',
      baseURL: 'https://api.openai.com/v1',
    });
    const result = await a.analyze(input());
    expect(result).toBeNull();
  });

  it('returns null when assistant content is not valid JSON', async () => {
    fetchMock.mockResolvedValue(fakeJsonResponse(chatCompletionsBody('not json at all')));
    const a = new Analyzer({
      provider: 'openai',
      apiKey: 'sk',
      model: 'm',
      baseURL: 'https://api.openai.com/v1',
    });
    const result = await a.analyze(input());
    expect(result).toBeNull();
  });
});

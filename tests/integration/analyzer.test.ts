import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted to the top of the file, so any values it references must
// be declared via vi.hoisted — plain top-level `const` / `class` runs *after*
// the mock factory and fails with "cannot access before initialization".
const mocks = vi.hoisted(() => {
  class FakeAPIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    createMock: vi.fn(),
    FakeAPIError,
  };
});

vi.mock('@anthropic-ai/sdk', () => {
  class FakeAnthropic {
    messages = { create: mocks.createMock };
    constructor(_opts: any) {}
    static APIError = mocks.FakeAPIError;
  }
  return { default: FakeAnthropic };
});

import { Analyzer } from '../../src/main/analyzer';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]);

function fakeResponse(jsonText: string) {
  return {
    content: [{ type: 'text', text: jsonText }],
    usage: { input_tokens: 100, output_tokens: 30 },
  };
}

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

describe('Analyzer.analyze', () => {
  beforeEach(() => {
    mocks.createMock.mockReset();
  });

  it('returns a parsed HintResult when the model says needs_hint=true', async () => {
    mocks.createMock.mockResolvedValue(
      fakeResponse(
        JSON.stringify({
          needs_hint: true,
          hint: 'Click Save to apply the change.',
          confidence: 'high',
          reason: 'unsaved dialog visible',
        }),
      ),
    );
    const a = new Analyzer({ provider: 'anthropic', apiKey: 'test-key', model: 'claude-opus-4-7' });
    const result = await a.analyze(input({ cursorX: 100, cursorY: 200, idleMs: 8000 }));
    expect(result).not.toBeNull();
    expect(result!.needsHint).toBe(true);
    expect(result!.hint).toBe('Click Save to apply the change.');
    expect(result!.confidence).toBe('high');
  });

  it('returns a HintResult with needsHint=false when the model declines', async () => {
    mocks.createMock.mockResolvedValue(
      fakeResponse(
        JSON.stringify({
          needs_hint: false,
          hint: '',
          confidence: 'low',
          reason: 'nothing actionable',
        }),
      ),
    );
    const a = new Analyzer({ provider: 'anthropic', apiKey: 'test-key', model: 'claude-opus-4-7' });
    const result = await a.analyze(input({ idleMs: 5000 }));
    expect(result).not.toBeNull();
    expect(result!.needsHint).toBe(false);
  });

  it('sends the screenshot as a base64 image content block with media_type image/png', async () => {
    mocks.createMock.mockResolvedValue(
      fakeResponse(JSON.stringify({ needs_hint: false, hint: '', confidence: 'low', reason: 'x' })),
    );
    const a = new Analyzer({ provider: 'anthropic', apiKey: 'test-key', model: 'claude-opus-4-7' });
    await a.analyze(input({ cursorX: 50, cursorY: 60, screenWidth: 800, screenHeight: 600 }));
    expect(mocks.createMock).toHaveBeenCalledOnce();
    const callArgs = mocks.createMock.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-opus-4-7');
    const userMsg = callArgs.messages[0];
    expect(userMsg.role).toBe('user');
    const imageBlock = userMsg.content.find((b: any) => b.type === 'image');
    expect(imageBlock).toBeDefined();
    expect(imageBlock.source.type).toBe('base64');
    expect(imageBlock.source.media_type).toBe('image/png');
    expect(imageBlock.source.data).toBe(PNG.toString('base64'));
  });

  it('sets cache_control on the system prompt', async () => {
    mocks.createMock.mockResolvedValue(
      fakeResponse(JSON.stringify({ needs_hint: false, hint: '', confidence: 'low', reason: 'x' })),
    );
    const a = new Analyzer({ provider: 'anthropic', apiKey: 'test-key', model: 'claude-opus-4-7' });
    await a.analyze(input());
    const callArgs = mocks.createMock.mock.calls[0][0];
    expect(Array.isArray(callArgs.system)).toBe(true);
    expect(callArgs.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('uses output_config with a json_schema format', async () => {
    mocks.createMock.mockResolvedValue(
      fakeResponse(JSON.stringify({ needs_hint: false, hint: '', confidence: 'low', reason: 'x' })),
    );
    const a = new Analyzer({ provider: 'anthropic', apiKey: 'test-key', model: 'claude-opus-4-7' });
    await a.analyze(input());
    const callArgs = mocks.createMock.mock.calls[0][0];
    expect(callArgs.output_config.format.type).toBe('json_schema');
    expect(callArgs.output_config.format.schema.required).toContain('needs_hint');
  });

  it('passes an explicit "user pressed the hotkey" note when userRequested=true', async () => {
    mocks.createMock.mockResolvedValue(
      fakeResponse(JSON.stringify({ needs_hint: false, hint: '', confidence: 'low', reason: 'x' })),
    );
    const a = new Analyzer({ provider: 'anthropic', apiKey: 'test-key', model: 'claude-opus-4-7' });
    await a.analyze(input({ idleMs: 0, userRequested: true }));
    const callArgs = mocks.createMock.mock.calls[0][0];
    const textBlock = callArgs.messages[0].content.find((b: any) => b.type === 'text');
    expect(textBlock.text).toMatch(/PRESSED THE HOTKEY/);
  });

  it('returns null when the model returns invalid JSON', async () => {
    mocks.createMock.mockResolvedValue(fakeResponse('not json at all'));
    const a = new Analyzer({ provider: 'anthropic', apiKey: 'test-key', model: 'claude-opus-4-7' });
    const result = await a.analyze(input());
    expect(result).toBeNull();
  });

  it('returns null when the SDK throws an APIError', async () => {
    mocks.createMock.mockRejectedValue(new mocks.FakeAPIError(429, 'rate limited'));
    const a = new Analyzer({ provider: 'anthropic', apiKey: 'test-key', model: 'claude-opus-4-7' });
    const result = await a.analyze(input());
    expect(result).toBeNull();
  });

  it('returns null when the SDK throws a generic error', async () => {
    mocks.createMock.mockRejectedValue(new Error('network down'));
    const a = new Analyzer({ provider: 'anthropic', apiKey: 'test-key', model: 'claude-opus-4-7' });
    const result = await a.analyze(input());
    expect(result).toBeNull();
  });
});

import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are Magic Pointer, an unobtrusive assistant that watches a user's screen and offers proactive hints only when they would clearly help.

The user shares: a screenshot of what they're looking at, their cursor position, and how long they've been idle (not moving the mouse, not typing). Decide whether a brief hint would help right now.

Offer a hint ONLY when there's a clear, specific signal the user is stuck, confused, or about to make a mistake. Good reasons:
- A dialog or error message is visible and they're hovering without acting
- A code editor shows an obvious bug or error squiggle near the cursor
- A form has an obvious validation problem
- They've opened a settings panel and the relevant toggle is right there
- A clear next action is needed (click Save, password needs a number, etc.)

Do NOT offer hints for:
- Normal reading, writing, browsing, scrolling — even if slow
- Watching videos or media
- Anything the user clearly already knows how to do
- Speculative "you could try…" advice with no signal of stuckness
- Privacy-sensitive content (banking, medical, private chats) — return needs_hint=false silently

Be conservative. Most of the time return needs_hint=false. False positives are worse than false negatives.

When you do offer a hint:
- One short sentence (≤ 120 characters)
- Actionable and specific to what's on screen
- In the user's language (infer from the screenshot)
- Never patronizing

Return JSON only — no prose.`;

const SCHEMA = {
  type: 'object',
  properties: {
    needs_hint: { type: 'boolean', description: 'True only if you are clearly helping.' },
    hint: { type: 'string', description: 'The one-sentence hint, or empty string.' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    reason: { type: 'string', description: 'One short phrase explaining why (for debugging).' },
  },
  required: ['needs_hint', 'hint', 'confidence', 'reason'],
  additionalProperties: false,
} as const;

export interface HintResult {
  needsHint: boolean;
  hint: string;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
}

export interface AnalyzeInput {
  pngBuffer: Buffer;
  cursorX: number;
  cursorY: number;
  screenWidth: number;
  screenHeight: number;
  idleMs: number;
  userRequested: boolean;
}

export class Analyzer {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async analyze(input: AnalyzeInput): Promise<HintResult | null> {
    const b64 = input.pngBuffer.toString('base64');
    const note = input.userRequested
      ? 'The user PRESSED THE HOTKEY to explicitly ask for help. Be more willing to offer a useful hint, but still skip if nothing is obviously actionable.'
      : `The user has been idle for ${Math.round(input.idleMs / 1000)} seconds. Apply the conservative bar.`;

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
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: b64,
                },
              },
              {
                type: 'text',
                text: `Cursor at (${input.cursorX}, ${input.cursorY}) on a ${input.screenWidth}×${input.screenHeight} screen capture. ${note}`,
              },
            ],
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: SCHEMA as any,
          },
        },
      } as any);

      const text = response.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');
      if (!text) return null;

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        console.warn('Analyzer: bad JSON from model:', text.slice(0, 200));
        return null;
      }
      return {
        needsHint: Boolean(parsed.needs_hint),
        hint: String(parsed.hint ?? '').trim(),
        confidence: (parsed.confidence ?? 'low') as HintResult['confidence'],
        reason: String(parsed.reason ?? ''),
      };
    } catch (e: any) {
      if (e instanceof Anthropic.APIError) {
        console.warn(`Anthropic API error (${e.status}): ${e.message}`);
      } else {
        console.warn('Analyzer error:', e?.message ?? e);
      }
      return null;
    }
  }
}

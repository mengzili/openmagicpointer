// Shared types and prompts for VLM providers. Pure data — no SDK imports here
// so unit tests can pull this in without touching network code.

export interface HintResult {
  needsHint: boolean;
  hint: string;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
  category: string;
}

export interface HintEntry {
  hint: string;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
  category: string;
  timestamp: number;
  userRequested: boolean;
}

export interface AnalyzeInput {
  pngBuffer: Buffer;
  cursorX: number;
  cursorY: number;
  screenWidth: number;
  screenHeight: number;
  idleMs: number;
  userRequested: boolean;
  aggressiveness?: number;
}

export interface VlmProvider {
  analyze(input: AnalyzeInput): Promise<HintResult | null>;
  explain?(input: Omit<AnalyzeInput, 'userRequested' | 'idleMs' | 'aggressiveness'>): Promise<ExplainResult | null>;
}

export const SYSTEM_PROMPT = `You are Magic Pointer, a creative productivity coach that watches a user's screen and proactively suggests what they should do next.

You receive: a screenshot, cursor position, and idle time. Your job is NOT to describe what's on screen — the user can see that. Your job is to creatively suggest an ACTION they could take right now.

## Adaptive tone

Pick your tone based on context:
- **Coach mode** (user is idle, browsing aimlessly, staring at inbox, unfocused): Be opinionated and direct. "Draft a reply to that top email — even two sentences moves it forward." / "You've been on this page a while — time to switch to something with a deadline."
- **Nudge mode** (user is actively working but could use a tip): Be gentler. "Meeting in 15 min — maybe prep one talking point?" / "That function is getting long — extract the loop into a helper?"

## What makes a great hint

- Suggests a SPECIFIC next action, not a vague observation
- Is creative — surprises the user with an angle they hadn't considered
- References what's actually visible (app, content, time cues)
- Feels like a smart friend looking over your shoulder, not a robot reading pixels

## Examples of great hints

- "That PR has 3 unresolved comments — knock those out before your 2pm."
- "You've scrolled past this article twice — either bookmark it or close the tab."
- "Inbox zero is 4 emails away. Start with the oldest one."
- "This code works but the variable names are cryptic — rename before you forget what they mean."
- "You've been idle 30 seconds on a blank doc — just write one bad sentence to break the ice."
- "Your 2pm with Sarah is in 15 min — prep one talking point from last time."
- "You've been on Reddit for 12 minutes — time to switch back to that deadline."

## When NOT to hint

- Privacy-sensitive content (banking, medical, private chats) — return needs_hint=false silently
- User is watching video/media — return needs_hint=false

## Output format

Return JSON only — no prose, no markdown fences. Fields:
- needs_hint (boolean): true if you have something useful to suggest
- hint (string): one sentence, ≤ 140 characters, actionable
- confidence ("low"|"medium"|"high")
- reason (string): one phrase explaining your reasoning (for debugging)
- category (string): one of "coding", "email", "browsing", "productivity", "communication", "break", "other"`;

export const SCHEMA = {
  type: 'object',
  properties: {
    needs_hint: { type: 'boolean', description: 'True if you have a useful suggestion.' },
    hint: { type: 'string', description: 'One actionable sentence, or empty string.' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    reason: { type: 'string', description: 'One short phrase explaining why (for debugging).' },
    category: { type: 'string', enum: ['coding', 'email', 'browsing', 'productivity', 'communication', 'break', 'other'] },
  },
  required: ['needs_hint', 'hint', 'confidence', 'reason', 'category'],
  additionalProperties: false,
} as const;

export const EXPLAIN_PROMPT = `You are a universal explainer. The user pressed a hotkey asking you to explain whatever is near their cursor on screen.

Look at the screenshot and cursor position. Identify the element, text, error message, code, UI control, or content nearest to the cursor and explain it in plain, simple language.

Rules:
- Be concise: 1-3 sentences max
- Explain the WHY and WHAT, not just restate what's visible
- For error messages: explain what caused it and how to fix it
- For code: explain what it does in plain English
- For UI elements: explain what they do and when to use them
- For dense text: summarize the key point

Return JSON only. Fields: explanation (string, 1-3 sentences), topic (string, 2-3 word label for what you explained).`;

export interface ExplainResult {
  explanation: string;
  topic: string;
}

export function parseExplainJson(text: string): ExplainResult | null {
  try {
    const parsed = JSON.parse(stripFences(text));
    return {
      explanation: String(parsed.explanation ?? '').trim(),
      topic: String(parsed.topic ?? '').trim(),
    };
  } catch {
    const clean = stripFences(text).trim();
    if (clean.length > 0) return { explanation: clean, topic: '' };
    return null;
  }
}

export function formatUserText(input: AnalyzeInput, aggressiveness?: number): string {
  const level = aggressiveness ?? 3;
  const tone = level <= 2
    ? 'Only suggest something if the user is clearly stuck or about to make a mistake.'
    : level >= 4
      ? 'Be proactive — suggest next actions freely, even if the user might already know.'
      : 'Suggest what they should do next if you can add value.';

  const note = input.userRequested
    ? 'The user PRESSED THE HOTKEY to explicitly ask for a suggestion. Always offer a creative, actionable hint about what they should do next.'
    : `The user has been idle for ${Math.round(input.idleMs / 1000)} seconds. ${tone}`;
  return `Cursor at (${input.cursorX}, ${input.cursorY}) on a ${input.screenWidth}×${input.screenHeight} screen. ${note}`;
}

export function parseHintJson(text: string): HintResult | null {
  let parsed: any;
  try {
    parsed = JSON.parse(stripFences(text));
  } catch {
    console.warn('Analyzer: bad JSON from model:', text.slice(0, 200));
    return null;
  }
  return {
    needsHint: Boolean(parsed.needs_hint),
    hint: String(parsed.hint ?? '').trim(),
    confidence: (parsed.confidence ?? 'low') as HintResult['confidence'],
    reason: String(parsed.reason ?? ''),
    category: String(parsed.category ?? 'other'),
  };
}

function stripFences(s: string): string {
  const t = s.trim();
  if (!t.startsWith('```')) return t;
  return t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import Anthropic from '@anthropic-ai/sdk';
import * as path from 'path';
import * as fs from 'fs';

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'vlm');

// These tests send rendered overlay screenshots to Claude Sonnet 4.6 and ask
// it whether the UI looks acceptable. Skipped when no real ANTHROPIC_API_KEY
// is available — the rest of the e2e suite still validates wiring.
const hasRealKey =
  !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'test-fake';

test.describe('VLM-judged visual quality', () => {
  test.skip(!hasRealKey, 'Set a real ANTHROPIC_API_KEY to run VLM checks');

  let app: ElectronApplication;
  let overlay: Page;

  test.beforeAll(async () => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    app = await electron.launch({
      args: [PROJECT_ROOT],
      env: { ...process.env, MAGICPOINTER_TEST: '1' },
      timeout: 30_000,
    });
    overlay = await app.firstWindow({ timeout: 15_000 });
  });

  test.afterAll(async () => {
    if (app) {
      try {
        await Promise.race([
          app.evaluate(({ app: electronApp }) => electronApp.exit(0)),
          new Promise(resolve => setTimeout(resolve, 2_000)),
        ]);
      } catch { /* process already gone */ }
      await Promise.race([
        app.close().catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 5_000)),
      ]);
    }
  });

  const SAMPLES: Array<{ slug: string; text: string }> = [
    { slug: 'short', text: 'Click Save to apply.' },
    { slug: 'medium', text: "Looks like you're doing fine — no hint to add." },
    { slug: 'long', text: 'The password needs to include at least one number — try adding a digit before continuing.' },
    { slug: 'greeting', text: 'OpenMagicPointer is on. F8 for hint, F9 to pause.' },
  ];

  for (const sample of SAMPLES) {
    test(`Claude Sonnet approves the rendered bubble for "${sample.slug}"`, async () => {
      await app.evaluate(({}, args) => {
        (globalThis as any).__test.overlay.showHint(args.text, args.x, args.y, args.duration);
      }, { text: sample.text, x: 200, y: 200, duration: 12_000 });

      await overlay.waitForFunction(
        (expected) => document.getElementById('hint-text')?.textContent === expected,
        sample.text,
        { timeout: 5_000 },
      );
      await overlay.waitForTimeout(450); // let the fade-in / pulse settle

      const buf = await overlay.screenshot({
        type: 'png',
        omitBackground: false,
        animations: 'disabled', // freeze the pulsing dot so screenshot doesn't hang
        timeout: 10_000,
      });
      const outPath = path.join(SCREENSHOT_DIR, `${sample.slug}.png`);
      fs.writeFileSync(outPath, buf);

      const verdict = await judgeBubbleUI(buf, sample.text);
      // Persist the verdict next to the screenshot for human review.
      fs.writeFileSync(
        path.join(SCREENSHOT_DIR, `${sample.slug}.verdict.json`),
        JSON.stringify(verdict, null, 2),
      );

      expect(
        verdict.acceptable,
        `VLM flagged issues for "${sample.slug}": ${verdict.issues.join(' | ')}`,
      ).toBe(true);
      expect(verdict.text_readable).toBe(true);
    });
  }
});

interface BubbleVerdict {
  acceptable: boolean;
  text_readable: boolean;
  text_seen: string;
  issues: string[];
  notes: string;
}

const JUDGE_SYSTEM = `You are a UI reviewer for OpenMagicPointer, a Windows desktop hint-overlay.

The intended look: a small rounded-corner bubble with a translucent dark background, a thin blue/violet glow border, a tiny pulsing dot on the left, and crisp readable text on the right. It floats above other windows on a transparent canvas.

Be strict but fair. Reject anything with broken layout, clipped or invisible text, missing background, garbled rendering, or content that looks like it failed to load. Approve renderings that look like a polished production notification.

Return strict JSON only — no prose.`;

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    acceptable: { type: 'boolean' },
    text_readable: { type: 'boolean', description: 'Can the hint text be clearly read?' },
    text_seen: { type: 'string', description: 'The exact text you can read in the bubble, or empty string.' },
    issues: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['acceptable', 'text_readable', 'text_seen', 'issues', 'notes'],
  additionalProperties: false,
} as const;

async function judgeBubbleUI(pngBytes: Buffer, expectedText: string): Promise<BubbleVerdict> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: [{ type: 'text', text: JUDGE_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: pngBytes.toString('base64') },
          },
          {
            type: 'text',
            text: `The hint text the bubble should be showing is: "${expectedText}". Judge whether the rendering is acceptable as production UI and whether the text is readable.`,
          },
        ],
      },
    ],
    output_config: { format: { type: 'json_schema', schema: VERDICT_SCHEMA as any } },
  } as any);

  const text = response.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');
  return JSON.parse(text);
}

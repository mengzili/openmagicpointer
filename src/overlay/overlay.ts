// No imports / exports — keeps the compiled JS module-free so the browser can
// load it via a plain <script src>. tsc with module=commonjs would otherwise
// emit Object.defineProperty(exports, ...) which throws in browser context.

interface ShowHintPayload {
  text: string;
  durationMs: number;
  maxWidth: number;
  minWidth: number;
}

interface MagicPointerBridge {
  onHint(handler: (payload: ShowHintPayload) => void): void;
}

(function () {
  const bridge = (window as unknown as { magicPointer: MagicPointerBridge }).magicPointer;
  const bubble = document.getElementById('bubble') as HTMLDivElement;
  const textEl = document.getElementById('hint-text') as HTMLDivElement;

  let hideTimer: number | null = null;

  bridge.onHint((payload) => {
    textEl.textContent = payload.text;
    bubble.style.maxWidth = `${payload.maxWidth - 16}px`;
    bubble.classList.remove('hidden');
    void bubble.offsetWidth; // reflow so the transition replays
    bubble.classList.add('visible');

    if (hideTimer !== null) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      bubble.classList.remove('visible');
      bubble.classList.add('hidden');
    }, payload.durationMs);
  });
})();

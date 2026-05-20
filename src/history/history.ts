interface HintEntry {
  hint: string;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
  category: string;
  timestamp: number;
  userRequested: boolean;
}

interface HistoryBridge {
  get(): Promise<HintEntry[]>;
  clear(): Promise<{ ok: boolean }>;
}

(async function () {
  const bridge = (window as unknown as { historyBridge: HistoryBridge }).historyBridge;
  const timeline = document.getElementById('timeline') as HTMLElement;
  const empty = document.getElementById('empty') as HTMLElement;
  const categories = document.getElementById('categories') as HTMLElement;
  const wordcloud = document.getElementById('wordcloud') as HTMLElement;
  const clearBtn = document.getElementById('clear') as HTMLButtonElement;

  const CAT_COLORS: Record<string, string> = {
    coding: '#50c878',
    email: '#ffb450',
    browsing: '#64b4ff',
    productivity: '#b478ff',
    communication: '#ff82b4',
    break: '#78dcc8',
    other: '#a0a0b4',
  };

  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'it', 'to', 'in', 'on', 'of', 'for', 'and',
    'or', 'you', 'your', 'that', 'this', 'with', 'from', 'are', 'was',
    'be', 'has', 'have', 'do', 'does', 'not', 'but', 'if', 'at', 'by',
    'so', 'up', 'out', 'no', 'just', 'can', 'one', 'all', 'its', 'than',
  ]);

  async function render() {
    const entries = await bridge.get();
    if (entries.length === 0) {
      empty.style.display = '';
      categories.innerHTML = '';
      wordcloud.innerHTML = '';
      return;
    }
    empty.style.display = 'none';

    // Timeline (newest first)
    const cards = entries.slice().reverse().map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const src = e.userRequested ? '⌨️' : '⏱️';
      return `<div class="hint-card">
        <div class="hint-text">${esc(e.hint)}</div>
        <div class="hint-meta">
          <span class="badge badge-${e.category}">${e.category}</span>
          <span>${time}</span>
          <span>${src}</span>
        </div>
      </div>`;
    }).join('');
    // Keep the empty element but hide it; replace the rest
    timeline.innerHTML = `<p class="empty" id="empty" style="display:none"></p>` + cards;

    // Categories
    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.category] = (counts[e.category] || 0) + 1;
    const max = Math.max(...Object.values(counts), 1);
    categories.innerHTML = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, n]) => `<div class="cat-row">
        <span class="cat-label">${cat}</span>
        <div class="cat-bar"><div class="cat-fill" style="width:${(n / max) * 100}%;background:${CAT_COLORS[cat] || CAT_COLORS.other}"></div></div>
        <span class="cat-count">${n}</span>
      </div>`).join('');

    // Word cloud
    const freq: Record<string, number> = {};
    for (const e of entries) {
      const words = e.hint.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
      for (const w of words) {
        if (w.length > 3 && !STOP_WORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
      }
    }
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30);
    const maxFreq = sorted[0]?.[1] || 1;
    wordcloud.innerHTML = sorted.map(([word, n]) => {
      const size = 10 + Math.round((n / maxFreq) * 10);
      return `<span class="word" style="font-size:${size}px">${esc(word)}</span>`;
    }).join('');
  }

  function esc(s: string): string {
    return s.replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  }

  clearBtn.addEventListener('click', async () => {
    await bridge.clear();
    await render();
  });

  await render();
})();

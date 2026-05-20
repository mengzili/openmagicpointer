interface DailyDigest {
  date: string;
  totalMinutes: number;
  categories: Record<string, number>;
  peakHour: number;
  hintCount: number;
  topCategory: string;
}

interface DigestBridge {
  today(): Promise<DailyDigest>;
  week(): Promise<DailyDigest[]>;
}

const CAT_COLORS: Record<string, string> = {
  coding: '#50c878', email: '#ffb450', browsing: '#64b4ff',
  productivity: '#b478ff', communication: '#ff82b4', break: '#78dcc8', other: '#a0a0b4',
};

(async function () {
  const bridge = (window as unknown as { digestBridge: DigestBridge }).digestBridge;
  const today = await bridge.today();
  const week = await bridge.week();

  (document.getElementById('date') as HTMLElement).textContent = today.date;
  (document.getElementById('totalMin') as HTMLElement).textContent = String(today.totalMinutes);
  (document.getElementById('hintCount') as HTMLElement).textContent = String(today.hintCount);
  (document.getElementById('peakHour') as HTMLElement).textContent = today.totalMinutes > 0 ? `${today.peakHour}:00` : '-';
  (document.getElementById('topCat') as HTMLElement).textContent = today.topCategory;

  // Category bars
  const catBars = document.getElementById('catBars') as HTMLElement;
  const max = Math.max(...Object.values(today.categories), 1);
  catBars.innerHTML = Object.entries(today.categories)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, mins]) => `<div class="cat-row">
      <span class="cat-label">${cat}</span>
      <div class="cat-bar"><div class="cat-fill" style="width:${(mins/max)*100}%;background:${CAT_COLORS[cat]||CAT_COLORS.other}"></div></div>
      <span class="cat-mins">${mins}m</span>
    </div>`).join('') || '<p style="color:#6c7184">No data yet today.</p>';

  // Week chart
  const weekChart = document.getElementById('weekChart') as HTMLElement;
  const weekMax = Math.max(...week.map(d => d.totalMinutes), 1);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  weekChart.innerHTML = `<div class="week-row">${week.map(d =>
    `<div class="week-bar" style="height:${Math.max(2, (d.totalMinutes/weekMax)*100)}%"></div>`
  ).join('')}</div><div class="week-labels">${week.map(d =>
    `<span>${days[new Date(d.date).getDay()]}</span>`
  ).join('')}</div>`;
})();

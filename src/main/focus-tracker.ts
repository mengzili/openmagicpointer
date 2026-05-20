import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface SessionEntry {
  category: string;
  timestamp: number;
  durationMs: number; // time attributed to this category (poll interval)
}

export interface DailyDigest {
  date: string; // YYYY-MM-DD
  totalMinutes: number;
  categories: Record<string, number>; // category → minutes
  peakHour: number; // 0-23, hour with most activity
  hintCount: number;
  topCategory: string;
}

const DATA_FILE = () => path.join(app.getPath('userData'), 'focus-sessions.json');

interface SessionData {
  entries: SessionEntry[];
  lastPruned: number;
}

let cache: SessionData | null = null;

function load(): SessionData {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(DATA_FILE(), 'utf8');
    cache = JSON.parse(raw);
    return cache!;
  } catch {
    cache = { entries: [], lastPruned: Date.now() };
    return cache;
  }
}

function save(): void {
  const data = load();
  // Prune entries older than 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - data.lastPruned > 60 * 60 * 1000) {
    data.entries = data.entries.filter(e => e.timestamp > cutoff);
    data.lastPruned = Date.now();
  }
  const file = DATA_FILE();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

export function recordSession(category: string, durationMs: number): void {
  const data = load();
  data.entries.push({ category, timestamp: Date.now(), durationMs });
  // Batch writes — save every 10 entries
  if (data.entries.length % 10 === 0) save();
}

export function flushSessions(): void {
  save();
}

export function getDailyDigest(dateStr?: string): DailyDigest {
  const data = load();
  const target = dateStr || new Date().toISOString().slice(0, 10);
  const dayStart = new Date(target + 'T00:00:00').getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  const dayEntries = data.entries.filter(e => e.timestamp >= dayStart && e.timestamp < dayEnd);

  const categories: Record<string, number> = {};
  const hourBuckets: number[] = new Array(24).fill(0);

  for (const e of dayEntries) {
    const mins = e.durationMs / 60000;
    categories[e.category] = (categories[e.category] || 0) + mins;
    const hour = new Date(e.timestamp).getHours();
    hourBuckets[hour] += mins;
  }

  const totalMinutes = Object.values(categories).reduce((a, b) => a + b, 0);
  const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

  return {
    date: target,
    totalMinutes: Math.round(totalMinutes),
    categories: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, Math.round(v)])),
    peakHour,
    hintCount: dayEntries.length,
    topCategory,
  };
}

export function getWeekDigests(): DailyDigest[] {
  const digests: DailyDigest[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    digests.push(getDailyDigest(d.toISOString().slice(0, 10)));
  }
  return digests;
}

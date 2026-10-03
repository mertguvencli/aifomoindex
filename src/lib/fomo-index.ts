/**
 * An exploratory composite of activity in the tracked AI-news corpus.
 * 50 is the reference level. The composite is not a pace multiplier,
 * probability, measure of capability, or measure of human anxiety.
 *
 * Every signal is a ratio: the last 7 days against the average week of the 28
 * days before them. Ratios map onto 0–100 with r⁴ / (1 + r⁴), so the index
 * uses explicit modeling choices documented in the methodology.
 * The formula is intentionally small enough to argue about in a PR.
 */
import type { FeedItem } from "./dataset";

const DAY = 86_400_000;
const WINDOW_DAYS = 7;
const BASELINE_DAYS = 28;
/** Added to both sides of each ratio so a quiet signal (0 vs 1 story) can't swing the score. */
const PSEUDOCOUNT = 2;

/** First explicitly versioned baseline; arithmetic preserved from the initial index. */
export const METHOD_VERSION = "1.0.0";

/** Publisher-source group used by the lab-activity proxy (includes HF community posts). */
const LAB_SOURCES = new Set(["openai", "anthropic", "googleai", "deepmind", "huggingface", "mistral"]);

/** Hacker News points that make a story "must-read heat". */
const HEAT_POINTS = 200;

/**
 * When the dataset starts holding every story of each source (epoch ms), and
 * when the daily history should start. A reading only counts a source whose
 * coverage began before the reading's baseline, so the day a source is added
 * shows up in neither the window nor the baseline, and never looks like a spike.
 */
export interface Coverage {
  sources: Record<string, number>;
  historyFrom: number;
}

/** Headlines about work, jobs and labor — the "is this coming for my job?" signal. */
export const JOBS_PATTERN =
  /\b(jobs?|layoffs?|laid off|lays? off|fire[sd]? [\d,]+|workforce|unemploy\w*|hiring|labou?r market|careers?|employ(ees|ment)|white[- ]collar|entry[- ]level|replac\w* (me|us|you|workers|humans|staff|employees|engineers|developers|programmers))\b/i;
/** "Jobs" that are compute products, not employment (Hugging Face Jobs). */
const NOT_JOBS = /\b(hf|hugging ?face) jobs\b|\bon hf jobs\b/i;

export interface SignalDef {
  id: string;
  label: string;
  /** What the signal counts, in one line for the methodology panel. */
  describe: string;
  weight: number;
  /** Count-based signals are compared as ratios; `topicSpike` handles its own. */
  match?: (it: FeedItem) => boolean;
}

export const SIGNALS: SignalDef[] = [
  {
    id: "velocity",
    label: "News velocity",
    describe: "Collected records from sources eligible for this observation.",
    weight: 0.3,
    match: () => true,
  },
  {
    id: "launches",
    label: "Lab activity",
    describe: "Lab-source headlines matching model, product or agent keywords; not verified launches.",
    weight: 0.25,
    match: (it) =>
      LAB_SOURCES.has(it.source) && it.topics.some((t) => t === "models" || t === "products" || t === "agents"),
  },
  {
    id: "heat",
    label: "Community attention",
    describe: "Stories with at least 200 recorded Hacker News points; attention, not importance.",
    weight: 0.25,
    // Any story whose link made Hacker News, lab posts included. Rows from
    // before points were stored fall back to importance, which tracked them.
    match: (it) => (it.points ?? (it.source === "hackernews" && it.importance >= 3 ? HEAT_POINTS : 0)) >= HEAT_POINTS,
  },
  {
    id: "spike",
    label: "Topic spike",
    describe: "The topic that grew the most this week, versus a typical week's biggest grower.",
    weight: 0.2,
  },
];

export const JOBS_SIGNAL: SignalDef = {
  id: "jobs",
  label: "Employment mentions",
  describe: "Headlines about jobs, layoffs, hiring and automation of work.",
  weight: 0,
  match: (it) => it.source !== "huggingface" && JOBS_PATTERN.test(it.title) && !NOT_JOBS.test(it.title),
};

export interface Band {
  min: number;
  id: "chill" | "aware" | "anxious" | "fomo";
  label: string;
  verdict: string;
}

/** Highest band first, so `find` returns the first band the score clears. */
export const BANDS: Band[] = [
  { min: 75, id: "fomo", label: "High activity", verdict: "Tracked news activity is well above its recent baseline." },
  { min: 55, id: "anxious", label: "Elevated", verdict: "Tracked news activity is above its recent baseline." },
  { min: 35, id: "aware", label: "Near baseline", verdict: "Tracked news activity is near its recent baseline." },
  { min: 0, id: "chill", label: "Low activity", verdict: "Tracked news activity is below its recent baseline." },
];

export function bandFor(score: number): Band {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
}

export interface SignalReading {
  id: string;
  label: string;
  describe: string;
  weight: number;
  score: number;
  /** Stories in the last 7 days. */
  current: number;
  /** Average stories per 7 days over the baseline. */
  baseline: number;
  /** For the topic spike: which topic it was. */
  topic?: string;
}

export interface FomoReading {
  /** End of the 7-day window, epoch ms. */
  at: number;
  score: number;
  band: Band;
  signals: SignalReading[];
  jobs: SignalReading;
}

export interface FomoIndex {
  now: FomoReading;
  /** Score one week earlier, for the ▲/▼ delta. Undefined without enough history. */
  weekAgo?: number;
  /** One point per day, oldest first, starting once a full baseline exists. */
  history: { at: number; score: number; jobs: number }[];
  /** Highest-signal stories of the current window: why the score is what it is. */
  drivers: FeedItem[];
  /** Activity against the reference year; undefined until a full year is tracked. */
  longRun?: LongRun;
}

/**
 * Steepness of the ratio → score curve. Aggregate AI news volume is steady
 * week to week, so a gentle curve (r²) kept a quarter of backtest history
 * inside 45–63; r⁴ spreads ordinary weeks over ~40–70 and leaves 80+ for
 * genuine surges.
 */
const STEEPNESS = 4;

/** r⁴ / (1 + r⁴): 1× → 50, 1.4× → 79, 0.7× → 19. */
function curve(ratio: number): number {
  const r = ratio ** STEEPNESS;
  return Math.round((100 * r) / (1 + r));
}

const smoothedRatio = (current: number, baseline: number) => (current + PSEUDOCOUNT) / (baseline + PSEUDOCOUNT);
const ratioScore = (current: number, baseline: number) => curve(smoothedRatio(current, baseline));

/** A source counts toward a reading only if it was fully tracked since the baseline began. */
const coveredAt = (coverage: Coverage, baseStart: number) => (it: FeedItem) =>
  (coverage.sources[it.source] ?? Infinity) <= baseStart;

function countSignal(items: FeedItem[], def: SignalDef, end: number, coverage: Coverage): SignalReading {
  const winStart = end - WINDOW_DAYS * DAY;
  const baseStart = winStart - BASELINE_DAYS * DAY;
  const covered = coveredAt(coverage, baseStart);
  let current = 0;
  let base = 0;
  for (const it of items) {
    if (it.ts > end || it.ts <= baseStart || !covered(it) || !def.match!(it)) continue;
    if (it.ts > winStart) current++;
    else base++;
  }
  const baseline = (base * WINDOW_DAYS) / BASELINE_DAYS;
  return { id: def.id, label: def.label, describe: def.describe, weight: def.weight, current, baseline, score: ratioScore(current, baseline) };
}

/** Topics with too little volume are noisy; they need this many stories this week to count. */
const SPIKE_MIN_STORIES = 5;

interface Spike {
  topic?: string;
  current: number;
  baseline: number;
  ratio: number;
}

/** The topic that grew the most in the 7 days ending at `end`, versus its own baseline. */
function biggestSpike(items: FeedItem[], end: number, coverage: Coverage): Spike {
  const winStart = end - WINDOW_DAYS * DAY;
  const baseStart = winStart - BASELINE_DAYS * DAY;
  const covered = coveredAt(coverage, baseStart);
  const cur = new Map<string, number>();
  const base = new Map<string, number>();
  for (const it of items) {
    if (it.ts > end || it.ts <= baseStart || !covered(it)) continue;
    const bucket = it.ts > winStart ? cur : base;
    for (const t of it.topics) bucket.set(t, (bucket.get(t) ?? 0) + 1);
  }
  let best: Spike = { current: 0, baseline: 0, ratio: 1 };
  for (const [topic, current] of cur) {
    if (current < SPIKE_MIN_STORIES) continue;
    const baseline = ((base.get(topic) ?? 0) * WINDOW_DAYS) / BASELINE_DAYS;
    const ratio = smoothedRatio(current, baseline);
    if (!best.topic || ratio > best.ratio) best = { topic, current, baseline, ratio };
  }
  return best;
}

/**
 * Some topic always grows fastest, so the raw max ratio sits well above 1 even
 * in a quiet week. It's scored against the biggest spikes of the previous four
 * weeks instead: 50 means "a typical biggest spike".
 */
function spikeSignal(items: FeedItem[], def: SignalDef, end: number, coverage: Coverage): SignalReading {
  const now = biggestSpike(items, end, coverage);
  const past = [1, 2, 3, 4].map((w) => biggestSpike(items, end - w * WINDOW_DAYS * DAY, coverage).ratio);
  const typical = past.reduce((a, b) => a + b, 0) / past.length;
  return {
    id: def.id,
    label: def.label,
    describe: def.describe,
    weight: def.weight,
    current: now.current,
    baseline: now.baseline,
    score: curve(now.ratio / typical),
    ...(now.topic && { topic: now.topic }),
  };
}

export function readingAt(items: FeedItem[], end: number, coverage: Coverage): FomoReading {
  const signals = SIGNALS.map((s) =>
    s.match ? countSignal(items, s, end, coverage) : spikeSignal(items, s, end, coverage),
  );
  const total = signals.reduce((sum, s) => sum + s.weight, 0);
  const score = Math.round(signals.reduce((sum, s) => sum + s.score * s.weight, 0) / total);
  return { at: end, score, band: bandFor(score), signals, jobs: countSignal(items, JOBS_SIGNAL, end, coverage) };
}

/**
 * Compute today's index and its daily history. History begins once a full
 * window and baseline lie after `coverage.historyFrom`.
 */
/** How far back one reading looks: the window, its baseline, and four earlier weeks for the spike. */
const LOOKBACK = (WINDOW_DAYS + BASELINE_DAYS + 4 * WINDOW_DAYS) * DAY;

/** The items a reading at `end` can see, from a list sorted oldest first. */
function span(asc: FeedItem[], end: number): FeedItem[] {
  const first = (t: number) => {
    let lo = 0;
    let hi = asc.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (asc[mid]!.ts <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return asc.slice(first(end - LOOKBACK), first(end));
}

export function computeFomoIndex(items: FeedItem[], now: number, coverage: Coverage): FomoIndex {
  // Years of daily history re-read the same stories many times, so each
  // reading gets only the slice of stories it can see.
  const asc = [...items].sort((a, b) => a.ts - b.ts);
  const current = readingAt(span(asc, now), now, coverage);
  const historyStart = coverage.historyFrom + (WINDOW_DAYS + BASELINE_DAYS) * DAY;
  const history: FomoIndex["history"] = [];
  // Anchor daily points to `now` so the last point is exactly the current reading.
  for (let t = now; t >= historyStart; t -= DAY) {
    const r = t === now ? current : readingAt(span(asc, t), t, coverage);
    history.unshift({ at: t, score: r.score, jobs: r.jobs.score });
  }
  const weekAgo = history.length > WINDOW_DAYS ? history[history.length - 1 - WINDOW_DAYS].score : undefined;

  const longRun = computeLongRun(items, now, coverage);
  return { now: current, weekAgo, history, drivers: driversAt(span(asc, now), current), ...(longRun && { longRun }) };
}

/** Highest-signal stories of a reading's 7-day window: why the score is what it is. */
function driversAt(items: FeedItem[], reading: FomoReading, n = 3): FeedItem[] {
  const winStart = reading.at - WINDOW_DAYS * DAY;
  const spikeTopic = reading.signals.find((s) => s.id === "spike")?.topic;
  // A headline that names a lab or a model says why the week moved; a busy
  // Hacker News thread that only mentions AI in passing does not.
  const onTopic = (it: FeedItem) =>
    it.entities.length > 0 || it.topics.some((t) => t === "models" || t === "agents");
  const weight = (it: FeedItem) =>
    it.importance * 2 +
    (onTopic(it) ? 3 : 0) +
    ((it.points ?? 0) >= HEAT_POINTS ? 1 : 0) +
    (LAB_SOURCES.has(it.source) ? 1 : 0) +
    (spikeTopic && it.topics.includes(spikeTopic) ? 1 : 0);
  return items
    .filter((it) => it.ts > winStart && it.ts <= reading.at)
    .sort((a, b) => weight(b) - weight(a) || (b.points ?? 0) - (a.points ?? 0) || b.ts - a.ts)
    .slice(0, n);
}

export interface Peak {
  reading: FomoReading;
  drivers: FeedItem[];
}

/**
 * The highest points of the history, at least `gapDays` apart so one busy
 * month doesn't fill the list, each with the stories behind it.
 */
export function biggestWeeks(
  items: FeedItem[],
  history: FomoIndex["history"],
  coverage: Coverage,
  n = 10,
  gapDays = 28,
): Peak[] {
  const asc = [...items].sort((a, b) => a.ts - b.ts);
  const picked: FomoIndex["history"] = [];
  for (const h of [...history].sort((a, b) => b.score - a.score || a.at - b.at)) {
    if (picked.length === n) break;
    if (picked.every((p) => Math.abs(p.at - h.at) >= gapDays * DAY)) picked.push(h);
  }
  return picked.map((h) => {
    const slice = span(asc, h.at);
    const reading = readingAt(slice, h.at, coverage);
    return { reading, drivers: driversAt(slice, reading) };
  });
}

/**
 * The weekly index is relative to its own last month, so over years it hovers
 * around 50 by construction. The long-run level answers the other question —
 * how much more activity there is than when tracking began — by comparing a
 * trailing quarter with a fixed reference year, on the sources tracked since
 * the start so that adding a source can't masquerade as growth.
 */
const LEVEL_WINDOW_DAYS = 91;
const LEVEL_BASE_DAYS = 364;

export interface LongRunSignal {
  id: string;
  label: string;
  /** Stories per week over the trailing quarter. */
  current: number;
  /** Stories per week over the reference year. */
  base: number;
  ratio: number;
}

export interface LongRun {
  /** 100 = the reference year's weekly average. */
  level: number;
  /** The level on the index's 0–100 scale: r / (1 + r), so 1× → 50, 2× → 67, 4× → 80. */
  score: number;
  band: Band;
  /** The reference year, epoch ms. */
  baseFrom: number;
  baseTo: number;
  signals: LongRunSignal[];
  /** One point per week, oldest first; the last is the current level. */
  history: { at: number; level: number; score: number }[];
}

/** Items of an oldest-first list with `from < ts <= to`. */
function between(asc: FeedItem[], from: number, to: number): FeedItem[] {
  const first = (t: number) => {
    let lo = 0;
    let hi = asc.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (asc[mid]!.ts <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return asc.slice(first(from), first(to));
}

/**
 * Weighted geometric mean of each counting signal's weekly rate against the
 * reference year, × 100. Geometric, so a signal that grew 6× from a small base
 * can't swamp the others. The topic spike is relative by design and is left out.
 */
export function computeLongRun(items: FeedItem[], now: number, coverage: Coverage): LongRun | undefined {
  const baseFrom = coverage.historyFrom;
  const baseTo = baseFrom + LEVEL_BASE_DAYS * DAY;
  if (now < baseTo) return undefined;
  const asc = items.filter((it) => (coverage.sources[it.source] ?? Infinity) <= baseFrom).sort((a, b) => a.ts - b.ts);
  const defs = SIGNALS.filter((s) => s.match);
  const total = defs.reduce((n, s) => n + s.weight, 0);
  const weekly = (rows: FeedItem[], def: SignalDef, days: number) => (rows.filter(def.match!).length * WINDOW_DAYS) / days;
  const baseRows = between(asc, baseFrom, baseTo);
  const base = defs.map((d) => weekly(baseRows, d, LEVEL_BASE_DAYS));

  const at = (end: number) => {
    const rows = between(asc, end - LEVEL_WINDOW_DAYS * DAY, end);
    const signals = defs.map((d, i) => {
      const current = weekly(rows, d, LEVEL_WINDOW_DAYS);
      // Smoothed on quarter-sized counts, the scale the pseudocount was chosen for.
      const q = LEVEL_WINDOW_DAYS / WINDOW_DAYS;
      return { id: d.id, label: d.label, current, base: base[i]!, ratio: smoothedRatio(current * q, base[i]! * q) };
    });
    const r = Math.exp(signals.reduce((n, s, i) => n + defs[i]!.weight * Math.log(s.ratio), 0) / total);
    return { level: Math.round(100 * r), score: Math.round((100 * r) / (1 + r)), signals };
  };

  const history: LongRun["history"] = [];
  for (let t = now; t >= baseFrom + LEVEL_WINDOW_DAYS * DAY; t -= WINDOW_DAYS * DAY) {
    const { level, score } = at(t);
    history.unshift({ at: t, level, score });
  }
  const current = at(now);
  return { level: current.level, score: current.score, band: bandFor(current.score), baseFrom, baseTo, signals: current.signals, history };
}

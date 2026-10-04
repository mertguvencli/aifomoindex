import type { FomoIndex } from "./fomo-index";

const DAY = 86_400_000;

/**
 * First week with a shareable page. Nothing earlier could have been shared, and
 * pages from here on are never dropped, so a shared week link keeps resolving.
 */
export const SHARE_FROM = "2026-W40";

/** ISO week of a time, e.g. "2026-W40", in UTC. Sorts as a string. */
export function isoWeek(at: number): string {
  const d = new Date(at);
  const day = d.getUTCDay() || 7;
  // The ISO year is the one holding this week's Thursday.
  const thu = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - day);
  const year = new Date(thu).getUTCFullYear();
  const week = Math.floor((thu - Date.UTC(year, 0, 1)) / DAY / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export const weekPath = (week: string) => `/week/${week}`;
export const weekCardPath = (week: string) => `/og/week/${week}.png`;

export interface WeekReading {
  week: string;
  /** The week's last daily reading: its close, or the latest one while it runs. */
  at: number;
  score: number;
  /** Score seven days before `at`, for the ▲/▼ delta. */
  weekAgo?: number;
  /** Daily history up to and including `at`, so the card's trend ends that week. */
  history: FomoIndex["history"];
  /** True while the week is still the current one and its score can move. */
  open: boolean;
}

/** One reading per ISO week from SHARE_FROM on, oldest first. */
export function weeklyReadings(history: FomoIndex["history"]): WeekReading[] {
  const lastOfWeek = new Map<string, number>();
  history.forEach((h, i) => {
    const week = isoWeek(h.at);
    if (week >= SHARE_FROM) lastOfWeek.set(week, i);
  });
  const current = history.length ? isoWeek(history[history.length - 1]!.at) : undefined;
  return [...lastOfWeek].map(([week, i]) => ({
    week,
    at: history[i]!.at,
    score: history[i]!.score,
    weekAgo: i >= 7 ? history[i - 7]!.score : undefined,
    history: history.slice(0, i + 1),
    open: week === current,
  }));
}

/** "2026-W40" → "Week 40, 2026". */
export function weekLabel(week: string): string {
  const [year, w] = week.split("-W");
  return `Week ${Number(w)}, ${year}`;
}

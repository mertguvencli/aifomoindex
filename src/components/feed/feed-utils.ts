import type { FeedItem } from "@/lib/dataset";
import { ENTITIES, TOPICS } from "@/lib/taxonomy";

export const SOURCES: Record<string, { label: string }> = {
  hackernews: { label: "Hacker News" },
  openai: { label: "OpenAI" },
  anthropic: { label: "Anthropic" },
  googleai: { label: "Google AI" },
  deepmind: { label: "DeepMind" },
  huggingface: { label: "Hugging Face" },
  mistral: { label: "Mistral" },
  deepseek: { label: "DeepSeek" },
  xai: { label: "xAI" },
  qwen: { label: "Qwen" },
  zhipu: { label: "Z.ai" },
  moonshot: { label: "Moonshot" },
  seed: { label: "AI FOMO Index" },
};

export const sourceLabel = (id: string) => SOURCES[id]?.label ?? id;

export const TOPIC_LABEL = Object.fromEntries(TOPICS.map((t) => [t.id, t.label]));
export const ENTITY_LABEL = Object.fromEntries(ENTITIES.map((e) => [e.id, e.label]));

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export const RANGES = [
  { id: "24h", label: "24h", ms: DAY },
  { id: "7d", label: "7 days", ms: 7 * DAY },
  { id: "30d", label: "30 days", ms: 30 * DAY },
  { id: "all", label: "All time", ms: Infinity },
] as const;

export type RangeId = (typeof RANGES)[number]["id"];
export type SortId = "latest" | "top";

export interface Filters {
  q: string;
  range: RangeId;
  sources: string[];
  topics: string[];
  sort: SortId;
  mustRead: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  q: "",
  range: "all",
  sources: [],
  topics: [],
  sort: "latest",
  mustRead: false,
};

export const MUST_READ = 3;

export const rangeMs = (id: RangeId) => RANGES.find((r) => r.id === id)?.ms ?? Infinity;

/** Lowercased text a search query is matched against. */
export function haystack(item: FeedItem): string {
  return [
    item.title,
    item.summary,
    item.domain,
    sourceLabel(item.publisher),
    ...item.topics.map((t) => TOPIC_LABEL[t]),
    ...item.entities.map((e) => ENTITY_LABEL[e]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export const searchTerms = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Which parts of `f` does `item` pass? Flags rather than a boolean, so one pass
 * yields the results and each facet's counts (how many results a chip would
 * give if toggled), which ignore that facet's own selection.
 */
export function check(item: FeedItem, hay: string, f: Filters, terms: string[], now: number) {
  return {
    range: now - item.ts <= rangeMs(f.range),
    source: !f.sources.length || f.sources.includes(item.publisher),
    topic: !f.topics.length || f.topics.some((t) => item.topics.includes(t)),
    rest: (!f.mustRead || item.importance >= MUST_READ) && terms.every((t) => hay.includes(t)),
  };
}

// ---- URL <-> filters (static export, so no server-side search params) ----

export function filtersFromSearch(search: string): Filters {
  const p = new URLSearchParams(search);
  const list = (k: string) => p.get(k)?.split(",").filter(Boolean) ?? [];
  const range = p.get("range");
  return {
    q: p.get("q") ?? "",
    range: RANGES.some((r) => r.id === range) ? (range as RangeId) : DEFAULT_FILTERS.range,
    sources: list("source"),
    topics: list("topic"),
    sort: p.get("sort") === "top" ? "top" : "latest",
    mustRead: p.get("must") === "1",
  };
}

export function filtersToSearch(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.range !== DEFAULT_FILTERS.range) p.set("range", f.range);
  if (f.sources.length) p.set("source", f.sources.join(","));
  if (f.topics.length) p.set("topic", f.topics.join(","));
  if (f.sort !== "latest") p.set("sort", f.sort);
  if (f.mustRead) p.set("must", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ---- time ----

// Building an Intl.DateTimeFormat is far slower than using one, and these run per story.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(key: string, timeZone: string | undefined, make: (timeZone?: string) => Intl.DateTimeFormat) {
  const k = `${key}|${timeZone ?? ""}`;
  let f = formatters.get(k);
  if (!f) formatters.set(k, (f = make(timeZone)));
  return f;
}

/** `timeZone` is "UTC" until mount so server and client render identically. */
export function dayKey(ts: number, timeZone?: string): string {
  return formatter("day", timeZone, (timeZone) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }),
  ).format(ts);
}

export function dayLabel(ts: number, now: number, timeZone?: string): string {
  const key = dayKey(ts, timeZone);
  if (key === dayKey(now, timeZone)) return "Today";
  if (key === dayKey(now - DAY, timeZone)) return "Yesterday";
  const withYear = new Date(ts).getFullYear() !== new Date(now).getFullYear();
  return formatter(withYear ? "label-y" : "label", timeZone, (timeZone) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      month: "short",
      day: "numeric",
      ...(withYear && { year: "numeric" }),
    }),
  ).format(ts);
}

export function monthLabel(ts: number, timeZone?: string): string {
  return formatter("month", timeZone, (timeZone) => new Intl.DateTimeFormat("en-US", { timeZone, month: "short" })).format(ts);
}

export function shortDate(ts: number, timeZone?: string): string {
  return formatter("short", timeZone, (timeZone) =>
    new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }),
  ).format(ts);
}

export function monthYear(ts: number, timeZone?: string): string {
  return formatter("monthYear", timeZone, (timeZone) =>
    new Intl.DateTimeFormat("en-US", { timeZone, month: "short", year: "numeric" }),
  ).format(ts);
}

export function clock(ts: number, timeZone?: string): string {
  return formatter("clock", timeZone, (timeZone) =>
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }),
  ).format(ts);
}

export function ago(ts: number, now: number): string {
  const d = Math.max(0, now - ts);
  if (d < 60_000) return "just now";
  if (d < HOUR) return `${Math.floor(d / 60_000)}m ago`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h ago`;
  return `${Math.floor(d / DAY)}d ago`;
}

export const fmt = (n: number) => n.toLocaleString("en-US");

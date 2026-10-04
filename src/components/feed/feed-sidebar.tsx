"use client";

import { memo, useMemo } from "react";
import { ArrowRight, ArrowUpRight, Flame } from "lucide-react";
import type { FeedItem } from "@/lib/dataset";
import { ENTITIES, TOPICS } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import { DAY, MUST_READ, RANGES, ago, dayKey, fmt, rangeMs, shortDate, sourceLabel, type RangeId } from "./feed-utils";
import { REPO } from "@/lib/site";
import { SourceLogo } from "./source-logo";

// Each card gets its own wash so the column reads as distinct blocks.
const TONES = {
  sky: "from-sky-300/25",
  emerald: "from-emerald-300/25",
  rose: "from-rose-300/25",
  amber: "from-amber-300/30",
} as const;

function Card({
  title,
  hint,
  tone,
  children,
  className,
}: {
  title: string;
  hint?: string;
  tone: keyof typeof TONES;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-4xl bg-gradient-to-b to-white p-5", TONES[tone], className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="whitespace-nowrap text-2xl font-normal text-gray-900">{title}</h2>
        {hint && <span className="whitespace-nowrap text-xs text-gray-500">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

// Cards are memoized and their stats cached: the feed re-renders on every scroll
// tick and keystroke, while these only change with the items or the clock.

function rangeHint(range: RangeId) {
  return RANGES.find((r) => r.id === range)!.label.toLowerCase();
}

// ---- Pulse: stories per day, last 30 days ----

export const PulseCard = memo(function PulseCard({
  items,
  now,
  rangeMs,
  timeZone,
}: {
  /** Items matching every filter except the time range. */
  items: FeedItem[];
  now: number;
  rangeMs: number;
  timeZone?: string;
}) {
  const { days, week, prevWeek } = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const ts = now - (29 - i) * DAY;
      return { ts, key: dayKey(ts, timeZone), count: 0 };
    });
    const byKey = new Map(days.map((d) => [d.key, d]));
    let week = 0;
    let prevWeek = 0;
    for (const it of items) {
      const age = now - it.ts;
      if (age > 30 * DAY) continue;
      const d = byKey.get(dayKey(it.ts, timeZone));
      if (d) d.count++;
      if (age <= 7 * DAY) week++;
      else if (age <= 14 * DAY) prevWeek++;
    }
    return { days, week, prevWeek };
  }, [items, now, timeZone]);
  const max = Math.max(1, ...days.map((d) => d.count));
  const delta = prevWeek ? Math.round(((week - prevWeek) / prevWeek) * 100) : null;

  return (
    <Card title="Pulse" tone="sky" hint="stories per day · 30 days">
      <div className="mb-4 flex items-end gap-3">
        <span className="font-serif text-4xl leading-none text-gray-900 tabular-nums">{fmt(week)}</span>
        <div className="pb-1 text-xs text-gray-600">
          <p>stories this week</p>
          {delta !== null && (
            <p className={cn("font-medium", delta >= 0 ? "text-emerald-700" : "text-rose-700")}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs last week
            </p>
          )}
        </div>
      </div>
      <div className="flex h-20 items-end gap-[2px]" role="img" aria-label={`Stories per day over the last 30 days, peaking at ${max}`}>
        {days.map((d) => {
          const inRange = now - d.ts < rangeMs;
          return (
            <div key={d.key} className="group relative flex h-full flex-1 items-end">
              <div
                className={cn(
                  "w-full rounded-t-[4px] transition-colors",
                  inRange ? "bg-sky-500 group-hover:bg-sky-700" : "bg-sky-200 group-hover:bg-sky-300",
                )}
                style={{ height: d.count ? `${Math.max(4, (d.count / max) * 100)}%` : 0 }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                <span className="text-gray-300">{shortDate(d.ts, timeZone)}</span> · {d.count} {d.count === 1 ? "story" : "stories"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-gray-500">
        <span>{shortDate(days[0].ts, timeZone)}</span>
        <span>Today</span>
      </div>
    </Card>
  );
});

// ---- Fastest growing topics: last 7 days vs the 7 before ----

const SPARK_DAYS = 14;

// npm-style trend line: daily counts, oldest → newest, as a stroked line over a soft fill.
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const W = 100;
  const H = 24;
  const max = Math.max(1, ...values);
  const step = W / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(2)},${(H - 1 - (v / max) * (H - 3)).toFixed(2)}`);
  const line = `M${pts.join("L")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden>
      <path d={`${line}L${W},${H}L0,${H}Z`} className="fill-emerald-500/15" />
      <path
        d={line}
        fill="none"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="stroke-emerald-600"
      />
    </svg>
  );
}

export const GrowingCard = memo(function GrowingCard({
  items,
  now,
  active,
  onToggle,
}: {
  items: FeedItem[];
  now: number;
  active: string[];
  onToggle: (id: string) => void;
}) {
  const rows = useMemo(() => {
    // Only the last 14 days count; items are newest first, so stop at the first older one.
    const recent: FeedItem[] = [];
    for (const it of items) {
      if (now - it.ts > 14 * DAY) break;
      recent.push(it);
    }
    return TOPICS.map((t) => {
      let cur = 0;
      let prev = 0;
      const daily = new Array<number>(SPARK_DAYS).fill(0);
      for (const it of recent) {
        if (!it.topics.includes(t.id)) continue;
        const age = now - it.ts;
        if (age <= 7 * DAY) cur++;
        else prev++;
        const d = Math.floor(age / DAY);
        if (d >= 0 && d < SPARK_DAYS) daily[SPARK_DAYS - 1 - d]++;
      }
      return { ...t, cur, daily, growth: prev ? Math.round(((cur - prev) / prev) * 100) : cur ? 100 : 0 };
    })
      .filter((r) => r.cur >= 2)
      .sort((a, b) => b.growth - a.growth || b.cur - a.cur)
      .slice(0, 5);
  }, [items, now]);

  return (
    <Card title="Fastest Growing" tone="emerald" hint="last 14 days">
      {rows.length === 0 ? (
        <p className="px-3 text-sm text-gray-500">Not enough stories this week yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((r) => {
            const on = active.includes(r.id);
            return (
              <button
                key={r.id}
                onClick={() => onToggle(r.id)}
                aria-pressed={on}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-300",
                  on && "bg-emerald-100/70 hover:bg-emerald-100",
                )}
              >
                <ArrowRight
                  className={cn(
                    "size-4 shrink-0 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-700",
                    on ? "text-emerald-700" : "text-gray-400",
                  )}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm font-medium transition-colors group-hover:text-emerald-700",
                    on ? "text-emerald-700" : "text-gray-900",
                  )}
                >
                  {r.label}
                </span>
                <Sparkline values={r.daily} className="h-6 w-12 shrink-0 overflow-visible" />
                <span className="w-6 text-right text-xs text-gray-500 tabular-nums">{fmt(r.cur)}</span>
                <span
                  className={cn(
                    "w-11 text-right text-xs font-medium tabular-nums",
                    r.growth > 0 ? "text-emerald-700" : "text-gray-500",
                  )}
                >
                  {r.growth > 0 ? "+" : ""}
                  {r.growth}%
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
});

// ---- Who's in the news: entity mentions this week ----

export const EntitiesCard = memo(function EntitiesCard({
  items,
  now,
  range,
  query,
  onPick,
}: {
  items: FeedItem[];
  now: number;
  range: RangeId;
  query: string;
  onPick: (label: string) => void;
}) {
  const rows = useMemo(() => {
    const maxAge = rangeMs(range);
    const counts: Record<string, number> = {};
    for (const it of items) {
      if (now - it.ts > maxAge) continue;
      for (const e of it.entities) counts[e] = (counts[e] ?? 0) + 1;
    }
    return ENTITIES.map((e) => ({ ...e, count: counts[e.id] ?? 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [items, now, range]);
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <Card title="In the News" tone="rose" hint={`mentions · ${rangeHint(range)}`}>
      {rows.length === 0 ? (
        <p className="px-3 text-sm text-gray-500">No mentions in this period.</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((r) => {
            const on = query.trim().toLowerCase() === r.label.toLowerCase();
            return (
              <li key={r.id}>
                <button
                  onClick={() => onPick(r.label)}
                  aria-pressed={on}
                  className={cn(
                    "group w-full rounded-lg px-3 py-1.5 text-left outline-none transition-colors hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-300",
                    on && "bg-rose-100/70 hover:bg-rose-100",
                  )}
                >
                  <div className="flex items-baseline justify-between text-sm">
                    <span className={cn("font-medium group-hover:text-rose-700", on ? "text-rose-700" : "text-gray-900")}>
                      {r.label}
                    </span>
                    <span className="text-xs text-gray-600 tabular-nums">{r.count}</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-rose-400" style={{ width: `${(r.count / max) * 100}%` }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
});

// ---- Must reads ----

// The highest rated stories of the selected period, not just the newest must-reads.
export const MustReadsCard = memo(function MustReadsCard({
  items,
  now,
  range,
}: {
  items: FeedItem[];
  now: number;
  range: RangeId;
}) {
  const rows = useMemo(() => {
    const maxAge = rangeMs(range);
    return items
      .filter((it) => it.importance >= MUST_READ && now - it.ts <= maxAge)
      .sort((a, b) => b.importance - a.importance || b.ts - a.ts)
      .slice(0, 5);
  }, [items, now, range]);
  if (rows.length === 0) return null;
  return (
    <Card title="Must Reads" tone="amber" hint={`highest rated · ${rangeHint(range)}`}>
      <div className="divide-y divide-gray-100">
        {rows.map((it) => (
          <a
            key={it.id}
            href={it.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-3 rounded-lg px-3 py-2.5 outline-none transition-colors hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <Flame className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug text-gray-900 group-hover:text-amber-700">{it.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
                <SourceLogo source={it.publisher} className="size-3.5 rounded-[3px]" />
                {sourceLabel(it.publisher)} · {ago(it.ts, now)}
              </p>
            </div>
          </a>
        ))}
      </div>
    </Card>
  );
});

// ---- Open data ----

export function OpenDataCard() {
  const links = [
    { href: `${REPO}/blob/main/data/index.json`, label: "index.json", note: "every item, machine-readable" },
    { href: `${REPO}/tree/main/data/news`, label: "Markdown archive", note: "one file per story" },
    { href: `${REPO}/blob/main/pipeline/sources.config.json`, label: "Add a source", note: "a one-line PR" },
  ];
  return (
    <section className="rounded-4xl bg-gray-900 p-5 text-white">
      <h2 className="font-serif text-3xl">Open by default</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-300">
        Crawled every 6 hours by GitHub Actions. The dataset is CC BY 4.0, the code is MIT — fork it, query it, build on
        it.
      </p>
      <div className="mt-4 space-y-1">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-white/10"
          >
            <span>
              <span className="text-sm font-medium">{l.label}</span>
              <span className="ml-2 text-xs text-gray-400">{l.note}</span>
            </span>
            <ArrowUpRight className="size-4 text-gray-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
          </a>
        ))}
      </div>
    </section>
  );
}


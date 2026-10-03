"use client";

import { memo, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Code2, FileDown } from "lucide-react";
import { BANDS, type Band, type FomoIndex, type LongRun, type SignalReading } from "@/lib/fomo-index";
import { MILESTONES, type Milestone } from "@/lib/milestones";
import { BASE_PATH, REPO } from "@/lib/site";
import { cn } from "@/lib/utils";
import { DAY, TOPIC_LABEL, ago, monthYear, shortDate, sourceLabel } from "./feed-utils";
import { SourceLogo } from "./source-logo";

const TONE: Record<Band["id"], { wash: string; text: string; stroke: string; fill: string }> = {
  chill: { wash: "from-sky-300/30", text: "text-sky-800", stroke: "stroke-sky-500", fill: "fill-sky-500/15" },
  aware: { wash: "from-emerald-300/30", text: "text-emerald-800", stroke: "stroke-emerald-600", fill: "fill-emerald-500/15" },
  anxious: { wash: "from-amber-300/40", text: "text-amber-800", stroke: "stroke-amber-600", fill: "fill-amber-500/15" },
  fomo: { wash: "from-rose-300/40", text: "text-rose-800", stroke: "stroke-rose-600", fill: "fill-rose-500/15" },
};

/** Arc colors for the gauge, low → high. */
const ARC: Record<Band["id"], string> = {
  chill: "stroke-sky-400",
  aware: "stroke-emerald-400",
  anxious: "stroke-amber-400",
  fomo: "stroke-rose-400",
};


export const FomoHero = memo(function FomoHero({ index, timeZone }: { index: FomoIndex; timeZone?: string }) {
  const { now, weekAgo, history, drivers } = index;
  const tone = TONE[now.band.id];
  const delta = weekAgo === undefined ? null : now.score - weekAgo;

  return (
    <section
      aria-labelledby="fomo-index-title"
      className="animate-fade-in-up mx-auto max-w-6xl px-4 pb-4 opacity-0 sm:px-6"
    >
      <div className="mt-5">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          {/* Score: the only part tinted by the current band */}
          <div
            className={cn(
              "flex flex-col items-center rounded-3xl bg-gradient-to-b to-white p-5 text-center sm:p-6 lg:items-start lg:self-start lg:text-left",
              tone.wash,
            )}
          >
            <h1 id="fomo-index-title" className="text-sm font-medium uppercase tracking-[0.14em] text-gray-600">
              Current observation
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              How busy AI news was this week, against the month before.{" "}
              <a
                href={`${BASE_PATH}/about`}
                className="whitespace-nowrap font-medium text-gray-700 underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
              >
                Research brief
              </a>
            </p>

            <div className="mt-5 flex w-full flex-col items-center gap-6 sm:flex-row sm:items-end lg:items-end">
              <Gauge score={now.score} band={now.band} />
              <div className="flex flex-col items-center sm:items-start">
                <p className={cn("font-serif text-3xl leading-tight", tone.text)}>{now.band.label}</p>
                {delta !== null && (
                  <p className={cn("mt-1 text-sm font-medium tabular-nums", delta >= 0 ? "text-rose-700" : "text-emerald-700")}>
                    {delta === 0 ? "No change" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)}`} vs last week
                  </p>
                )}

              </div>
            </div>

            <p className="mt-5 max-w-md text-lg leading-snug text-gray-900">{now.band.verdict}</p>

            <p className="mt-2 max-w-md text-xs leading-relaxed text-gray-500">Exploratory news activity, not a measure of AI progress or personal anxiety. Historical readings are reconstructed retrospectively.</p>

            <History history={history} tone={tone} timeZone={timeZone} />
          </div>

          {/* Why */}
          <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0 lg:py-6 lg:pr-2">
            <div>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-2xl font-normal text-gray-900">Signals in this reading</h2>
                <span className="whitespace-nowrap text-xs text-gray-500">last 7 days vs the 28 before</span>
              </div>
              <ul className="space-y-3">
                {now.signals.map((s) => (
                  <SignalRow key={s.id} signal={s} />
                ))}
                <SignalRow signal={now.jobs} experimental />
              </ul>
            </div>

            {drivers.length > 0 && (
              <div>
                <h2 className="mb-1 text-2xl font-normal text-gray-900">Illustrative headlines</h2>
                <ul>
                  {drivers.map((it) => (
                    <li key={it.id}>
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group -mx-3 flex gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-white/90"
                      >
                        <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
                        <span className="min-w-0">
                          <span className="block text-[15px] font-medium leading-snug text-foreground transition-colors group-hover:text-foreground/70">
                            {it.title}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                            <SourceLogo source={it.publisher} className="size-3.5 rounded-[3px]" />
                            {sourceLabel(it.publisher)} · {ago(it.ts, now.at)}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-2 text-sm">
              <a
                href={`${REPO}/blob/main/src/lib/fomo-index.ts`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-gray-700 ring-1 ring-gray-200 transition hover:text-gray-900 hover:ring-gray-300"
              >
                <Code2 className="size-4 text-gray-400" />
                The formula is open — argue with it
                <ArrowUpRight className="size-3.5 text-gray-400" />
              </a>
              <a
                href={`${BASE_PATH}/fomo.json`}
                className="flex h-9 items-center rounded-full px-3.5 text-gray-600 transition-colors hover:bg-white/80 hover:text-gray-900"
              >
                fomo.json
              </a>
              <a
                href={`${BASE_PATH}/report.pdf`}
                download
                className="flex h-9 items-center gap-1.5 rounded-full px-3.5 text-gray-600 transition-colors hover:bg-white/80 hover:text-gray-900"
              >
                <FileDown className="size-4 text-gray-400" />
                Observation report (PDF)
              </a>
            </div>
          </div>
        </div>

        {index.longRun && <LongRunPanel longRun={index.longRun} current={now.band} timeZone={timeZone} />}
      </div>
    </section>
  );
});

// ---- pieces ----

/** A 180° dial split into the four bands, with a marker at the score. */
function Gauge({ score, band, label = "AI FOMO Index" }: { score: number; band: Band; label?: string }) {
  const R = 80;
  const CX = 100;
  const CY = 96;
  const point = (v: number, r = R) => {
    const a = Math.PI * (1 - v / 100);
    return [CX + r * Math.cos(a), CY - r * Math.sin(a)] as const;
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = point(from);
    const [x2, y2] = point(to);
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
  };
  const bands = [...BANDS].reverse(); // low → high
  const [mx, my] = point(score);

  return (
    <div className="relative w-56 shrink-0">
      <svg viewBox="0 0 200 110" className="w-full" role="img" aria-label={`${label} ${score} of 100: ${band.label}`}>
        {bands.map((b, i) => {
          const to = bands[i + 1]?.min ?? 100;
          // A hairline gap between segments; the ends stay flush.
          return (
            <path
              key={b.id}
              d={arc(b.min + (i ? 0.8 : 0), to - (i < bands.length - 1 ? 0.8 : 0))}
              fill="none"
              strokeWidth={14}
              className={cn(ARC[b.id], b.id === band.id ? "opacity-100" : "opacity-35")}
            />
          );
        })}
        <circle cx={mx} cy={my} r={10} className="fill-white" />
        <circle cx={mx} cy={my} r={6} className="fill-gray-900" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <span className="font-serif text-6xl leading-none text-gray-900 tabular-nums">{score}</span>
      </div>
    </div>
  );
}

function SignalRow({ signal, experimental }: { signal: SignalReading; experimental?: boolean }) {
  const ratio = signal.baseline > 0 ? signal.current / signal.baseline : null;
  const detail =
    signal.id === "spike" && signal.topic
      ? `${TOPIC_LABEL[signal.topic] ?? signal.topic} · ${signal.current} vs ${fmtAvg(signal.baseline)}/wk`
      : `${signal.current} vs ${fmtAvg(signal.baseline)}/wk`;
  return (
    <li className="group relative">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <span className="flex min-w-0 items-baseline gap-2 text-gray-900">
          <span className="cursor-help truncate font-medium decoration-gray-300 decoration-dotted underline-offset-4 group-hover:underline">
            {signal.label}
          </span>
          {experimental ? (
            <span className="rounded-full bg-white/80 px-1.5 text-[10px] uppercase tracking-wide text-gray-500 ring-1 ring-gray-200">
              experimental
            </span>
          ) : (
            <span className="text-xs text-gray-400 tabular-nums">×{signal.weight}</span>
          )}
        </span>
        <span className="shrink-0 text-xs text-gray-500 tabular-nums">
          {detail}
          {ratio !== null && (
            <span className={cn("ml-1.5 font-medium", ratio >= 1 ? "text-rose-700" : "text-emerald-700")}>
              {ratio >= 1 ? "▲" : "▼"}
              {Math.abs(Math.round((ratio - 1) * 100))}%
            </span>
          )}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-gray-900/10">
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full", experimental ? "bg-gray-400" : "bg-gray-900")}
            style={{ width: `${signal.score}%` }}
          />
          {/* 50 = a normal week */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-white" />
        </div>
        <span className="w-7 text-right text-xs font-medium text-gray-900 tabular-nums">{signal.score}</span>
      </div>
      <p
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-10 mb-1.5 max-w-xs translate-y-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition duration-150 group-hover:translate-y-0 group-hover:opacity-100"
      >
        {signal.describe}
      </p>
    </li>
  );
}

/** Days the home page sparkline shows. The full archive lives on /history. */
const SPARK_DAYS = 90;

function History({
  history: all,
  tone,
  timeZone,
}: {
  history: FomoIndex["history"];
  tone: (typeof TONE)[Band["id"]];
  timeZone?: string;
}) {
  const history = all.slice(-SPARK_DAYS);
  if (history.length < 2) return null;
  const W = 100;
  const H = 32;
  const y = (v: number) => H - (v / 100) * H;
  const step = W / (history.length - 1);
  const pts = history.map((h, i) => `${(i * step).toFixed(2)},${y(h.score).toFixed(2)}`);
  const line = `M${pts.join("L")}`;
  const peak = history.reduce((m, h) => (h.score > m.score ? h : m), history[0]);
  const days = Math.round((history[history.length - 1].at - history[0].at) / DAY);

  return (
    <div className="mt-6 w-full max-w-md">
      <div className="mb-1.5 flex justify-between text-xs text-gray-500">
        <span>Last {days} days</span>
        <span className="tabular-nums">
          peak {peak.score} · {shortDate(peak.at, timeZone)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-16 w-full"
        role="img"
        aria-label={`Index history over ${days} days, peaking at ${peak.score}`}
      >
        <line x1={0} x2={W} y1={y(50)} y2={y(50)} strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" className="stroke-gray-300" />
        <path d={`${line}L${W},${H}L0,${H}Z`} className={tone.fill} />
        <path d={line} fill="none" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className={tone.stroke} />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-gray-500">
        <span>{shortDate(history[0].at, timeZone)}</span>
        <span>dashed line = reference (50)</span>
        <span>{shortDate(history[history.length - 1].at, timeZone)}</span>
      </div>
      {all.length > history.length && (
        <a href={`${BASE_PATH}/history`} className="mt-2 inline-block text-xs font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900">
          Every week since {shortDate(all[0].at, timeZone)} →
        </a>
      )}
    </div>
  );
}

/** Activity since tracking began, against the first year: where things are heading, not how this week compares. */
/** How the weekly reading sits against its recent baseline, for the sentence tying both scores together. */
const VS_BASELINE: Record<Band["id"], string> = {
  fomo: "well above",
  anxious: "above",
  aware: "near",
  chill: "below",
};

function LongRunPanel({ longRun, current, timeZone }: { longRun: LongRun; current: Band; timeZone?: string }) {
  const { level, score, band, history, signals, baseFrom, baseTo } = longRun;
  const tone = TONE[band.id];
  const year = (t: number) => new Date(t).getUTCFullYear();
  const baseLabel = `${year(baseFrom)}–${String(year(baseTo)).slice(2)}`;

  return (
    <div className="mt-16 sm:mt-20">
      <div
        className={cn(
          "flex flex-col items-center rounded-3xl bg-gradient-to-b to-white p-5 text-center sm:p-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10 lg:text-left",
          tone.wash,
        )}
      >
        <div className="flex flex-col items-center lg:items-start">
          <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-gray-600">Overall FOMO Index</h2>
          <p className="mt-1 text-sm text-gray-500">
            How busy AI news is now, against when tracking began in {monthYear(baseFrom, timeZone)}.
          </p>
          <div className="mt-5 flex w-full flex-col items-center gap-6 sm:flex-row sm:items-end">
            <Gauge score={score} band={band} label="Overall AI FOMO Index" />
            <div className="flex flex-col items-center sm:items-start">
              <p className={cn("font-serif text-3xl leading-tight", tone.text)}>{band.label}</p>
              <p className="mt-1 text-sm font-medium text-gray-700 tabular-nums">{fmtMultiple(level / 100)} the {baseLabel} level</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center lg:max-w-md lg:items-start">
          <p className="mt-5 text-lg leading-snug text-gray-900 lg:mt-0">
            This week reads {VS_BASELINE[current.id]} its recent baseline, and that baseline itself runs at{" "}
            {fmtMultiple(level / 100)} the {baseLabel} level.
          </p>
          <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-gray-600 lg:justify-start">
            {signals.map((s) => (
              <li key={s.id}>
                {s.label} <span className="font-medium text-gray-900 tabular-nums">{fmtMultiple(s.ratio)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section aria-labelledby="long-run-history-title" className="mt-16 px-1 sm:mt-20 sm:px-0">
        <h2 id="long-run-history-title" className="text-2xl font-normal text-gray-900">How we got here</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Weekly activity since {monthYear(baseFrom, timeZone)}, with milestones for context. Milestones are an editorial
          selection, not inputs to the index.
        </p>
        <div className="mt-6">
          <LongRunChart history={history} baseLabel={baseLabel} timeZone={timeZone} />
        </div>
        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-gray-500">
          Trailing 13 weeks vs the first tracked year; weighted geometric mean of the three counting signals, scored so
          that 1× = 50 and 4× = 80. Growth here includes changes in how much the sources publish, not only in AI itself.
        </p>
      </section>
    </div>
  );
}

/**
 * The long-run level week by week: ×-gridlines against the reference year, year
 * ticks, the current level called out at the end, a hover readout, and the
 * milestones: moments as markers on the line, longer shifts as bars beneath it.
 * Each opens a card with what the index did after.
 */
function LongRunChart({
  history,
  baseLabel,
  timeZone,
}: {
  history: LongRun["history"];
  baseLabel: string;
  timeZone?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const plot = useRef<HTMLDivElement>(null);
  const gradient = useId();
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  if (history.length < 2) return null;

  const W = 100;
  const H = 40;
  const t0 = history[0].at;
  const t1 = history[history.length - 1].at;
  const top = Math.max(...history.map((h) => h.level), 100) * 1.12;
  // Both in percent of the plot box, so HTML overlays and the SVG share one scale.
  const x = (t: number) => ((t - t0) / (t1 - t0)) * 100;
  const y = (level: number) => (1 - level / top) * 100;
  const line = `M${history.map((h) => `${((x(h.at) * W) / 100).toFixed(2)},${((y(h.level) * H) / 100).toFixed(2)}`).join("L")}`;

  const end = history[history.length - 1];
  const multiples = Array.from({ length: Math.floor(top / 100) }, (_, i) => (i + 1) * 100);
  // Each year's slice of the axis, clipped to the data; boundaries get a tick.
  const years: { yr: number; from: number; to: number }[] = [];
  for (let yr = new Date(t0).getUTCFullYear(); yr <= new Date(t1).getUTCFullYear(); yr++) {
    years.push({ yr, from: x(Math.max(Date.UTC(yr, 0, 1), t0)), to: x(Math.min(Date.UTC(yr + 1, 0, 1), t1)) });
  }
  const point = hover === null ? null : history[hover];
  const day = (t: number) => new Date(t).toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric", year: "numeric" });

  // Weekly points are evenly spaced, so the nearest one is a rounding away.
  const nearest = (t: number) =>
    Math.min(Math.max(Math.round(((t - t0) / (t1 - t0)) * (history.length - 1)), 0), history.length - 1);
  const entry = (m: Milestone): MilestoneEntry => {
    const from = history[nearest(m.at)];
    const to = history[nearest(Math.min(m.end ?? m.at + AFTER_WEEKS * WEEK, t1))];
    return { m, from, to, weeks: Math.round((to.at - Math.max(m.at, t0)) / WEEK) };
  };
  const shown = MILESTONES.filter((m) => m.at <= t1 && (m.end ?? m.at) > t0 - AFTER_WEEKS * WEEK);

  // Moments closer than a marker's width share one marker.
  const moments: { key: string; left: number; level: number; entries: MilestoneEntry[] }[] = [];
  for (const m of shown.filter((m) => !m.end).sort((a, b) => a.at - b.at)) {
    const e = entry(m);
    const left = x(e.from.at);
    const prev = moments[moments.length - 1];
    if (prev && ((left - prev.left) / 100) * width < MARKER_PX) prev.entries.push(e);
    else moments.push({ key: m.id, left, level: e.from.level, entries: [e] });
  }

  // Names go in two rows above the plot, majors first; one that fits neither row
  // keeps only its marker.
  const labels = new Map<string, { row: number; start: number; text: string }>();
  if (width) {
    const rows: [number, number][][] = [[], []];
    const major = (k: (typeof moments)[number]) => (k.entries.some((e) => e.m.major) ? 0 : 1);
    for (const k of [...moments].sort((a, b) => major(a) - major(b) || a.left - b.left)) {
      const text = k.entries.map((e) => e.m.label).join(" · ");
      const w = text.length * LABEL_CHAR_PX;
      const center = (k.left / 100) * width;
      const start = Math.min(Math.max(center - w / 2, 0), width - w);
      const row = rows.findIndex((r) => r.every(([a, b]) => start + w + LABEL_GAP_PX < a || start > b + LABEL_GAP_PX));
      if (row < 0) continue;
      rows[row].push([start, start + w]);
      labels.set(k.key, { row, start, text });
    }
  }

  // Periods stack into as few lanes as they need.
  const laneEnds: number[] = [];
  const periods = shown
    .filter((m) => m.end)
    .sort((a, b) => a.at - b.at)
    .map((m) => {
      const from = x(Math.max(m.at, t0));
      const to = x(Math.min(m.end!, t1));
      let lane = laneEnds.findIndex((e) => e < from);
      if (lane < 0) lane = laneEnds.push(to) - 1;
      else laneEnds[lane] = to;
      return { key: m.id, from, to, lane, entries: [entry(m)] };
    });
  // A name may run past its bar, up to the next bar in the same lane.
  const room = (p: (typeof periods)[number]) =>
    ((Math.min(...periods.filter((q) => q.lane === p.lane && q.from > p.from).map((q) => q.from), 100) - p.from) / 100) * width;

  const card =
    moments.find((k) => k.key === active) ??
    periods.map((p) => ({ ...p, left: (p.from + p.to) / 2, level: 0 })).find((p) => p.key === active);
  const span = card && {
    from: Math.min(...card.entries.map((e) => x(e.from.at))),
    to: Math.max(...card.entries.map((e) => x(e.to.at))),
  };

  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const f = Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1);
    setHover(Math.round(f * (history.length - 1)));
    setActive(null);
  };

  // Hover, focus or a first tap opens a milestone's card; a second tap follows the link.
  const opener = (key: string) => ({
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") {
        setActive(key);
        setHover(null);
      }
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") setActive(null);
    },
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onPointerMove: (e: React.PointerEvent) => e.stopPropagation(),
    onFocus: () => setActive(key),
    onBlur: () => setActive(null),
    onClick: (e: React.MouseEvent) => {
      if (active !== key) {
        e.preventDefault();
        setActive(key);
        setHover(null);
      }
    },
  });

  return (
    <figure className="m-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2">
        {/* Milestone names, above the plot so they never sit on the line */}
        <div className="relative h-9 text-[11px] font-medium">
          {moments.map((k) => {
            const label = labels.get(k.key);
            if (!label) return null;
            return (
              <MilestoneLink
                key={k.key}
                url={k.entries[0].m.url}
                tabIndex={-1}
                {...opener(k.key)}
                className={cn(
                  "absolute whitespace-nowrap transition-colors",
                  label.row ? "top-4" : "top-0",
                  active === k.key ? "text-gray-900" : "text-gray-500 hover:text-gray-900",
                )}
                style={{ left: label.start }}
              >
                {label.text}
              </MilestoneLink>
            );
          })}
        </div>
        <span />

        <div
          ref={plot}
          className="relative h-56 touch-pan-y sm:h-64"
          onPointerMove={track}
          onPointerDown={track}
          onPointerLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible text-gray-900"
            role="img"
            aria-label={`Long-run activity level, now ${fmtMultiple(end.level / 100)} the ${baseLabel} average`}
          >
            <defs>
              <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.12} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>
            {multiples.map((m) => (
              <line
                key={m}
                x1={0}
                x2={W}
                y1={(y(m) * H) / 100}
                y2={(y(m) * H) / 100}
                vectorEffect="non-scaling-stroke"
                strokeDasharray={m === 100 ? "4 4" : undefined}
                className={m === 100 ? "stroke-gray-400" : "stroke-gray-900/[0.07]"}
              />
            ))}
            <line x1={0} x2={W} y1={H} y2={H} vectorEffect="non-scaling-stroke" className="stroke-gray-900/15" />
            <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${gradient})`} />
            <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="stroke-gray-900" />
          </svg>

          {/* The weeks a milestone's card describes */}
          {span && (
            <span
              className="pointer-events-none absolute inset-y-0 bg-gray-900/[0.05]"
              style={{ left: `${span.from}%`, width: `${span.to - span.from}%` }}
            />
          )}

          {moments.map((k) => {
            const label = labels.get(k.key);
            const first = k.entries[0].m;
            return (
              <span key={k.key}>
                {label && (
                  <span
                    className="pointer-events-none absolute w-px border-l border-dashed border-gray-900/20"
                    style={{
                      left: `${k.left}%`,
                      top: label.row ? 0 : "-1rem",
                      height: `calc(${y(k.level)}% + ${label.row ? 0 : 1}rem)`,
                    }}
                  />
                )}
                <MilestoneLink
                  url={first.url}
                  aria-label={k.entries.map((e) => `${e.m.title}, ${day(e.m.at)}`).join("; ")}
                  {...opener(k.key)}
                  className="group absolute z-10 flex min-h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none"
                  style={{ left: `${k.left}%`, top: `${y(k.level)}%` }}
                >
                  {/* The publisher's logo marks the moment; a shared marker shows its lead and a count. */}
                  {(() => {
                    const lead = (k.entries.find((e) => e.m.major) ?? k.entries[0]).m;
                    return (
                      <span
                        className={cn(
                          "relative flex shrink-0 transition-transform group-focus-visible:scale-125",
                          active === k.key && "scale-125",
                        )}
                      >
                        {lead.source ? (
                          <span className="rounded-[7px] bg-white p-0.5 shadow-sm ring-1 ring-gray-900/15">
                            <SourceLogo source={lead.source} className={label ? "size-5 rounded-[5px]" : "size-4 rounded-[4px]"} />
                          </span>
                        ) : (
                          <span className={cn("rounded-full bg-white ring-2 ring-gray-900", label ? "size-3" : "size-2")} />
                        )}
                        {k.entries.length > 1 && (
                          <span className="absolute -right-2 -top-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-gray-900 px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-white tabular-nums">
                            +{k.entries.length - 1}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </MilestoneLink>
              </span>
            );
          })}

          {card && (
            <MilestoneCard
              entries={card.entries}
              left={card.left}
              top={card.level ? y(card.level) : 100}
              day={day}
              timeZone={timeZone}
            />
          )}

          {/* Current level */}
          <span
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-900 ring-2 ring-white"
            style={{ left: "100%", top: `${y(end.level)}%` }}
          />

          {point && (
            <>
              <span className="pointer-events-none absolute inset-y-0 w-px bg-gray-900/20" style={{ left: `${x(point.at)}%` }} />
              <span
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-900 ring-2 ring-white"
                style={{ left: `${x(point.at)}%`, top: `${y(point.level)}%` }}
              />
              <span
                className={cn(
                  "pointer-events-none absolute z-10 -mt-3 -translate-y-full whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-xs shadow-lg ring-1 ring-gray-900/10",
                  x(point.at) > 70 ? "-translate-x-full" : x(point.at) < 30 ? "" : "-translate-x-1/2",
                )}
                style={{ left: `${x(point.at)}%`, top: `${y(point.level)}%` }}
              >
                <span className="font-semibold text-gray-900 tabular-nums">{fmtMultiple(point.level / 100)}</span>
                <span className="text-gray-500"> the {baseLabel} level · {day(point.at)}</span>
              </span>
            </>
          )}
        </div>

        {/* y axis: multiples of the reference year, with the current level called out */}
        <div className="relative w-9 text-[11px] tabular-nums">
          {multiples
            .filter((m) => Math.abs(y(m) - y(end.level)) > 7)
            .map((m) => (
              <span key={m} className="absolute left-0 -translate-y-1/2 text-gray-400" style={{ top: `${y(m)}%` }}>
                {m / 100}×
              </span>
            ))}
          <span className="absolute left-0 -translate-y-1/2 text-xs font-semibold text-gray-900" style={{ top: `${y(end.level)}%` }}>
            {fmtMultiple(end.level / 100)}
          </span>
        </div>

        {/* x axis */}
        <div className="relative h-6 text-[11px] text-gray-500 tabular-nums">
          {years.map(({ yr, from, to }, i) => (
            <span key={yr}>
              {from > 0 && <span className="absolute top-0 h-1.5 w-px bg-gray-900/20" style={{ left: `${from}%` }} />}
              {/* A slice too narrow to centre its year in (a few weeks at either end) pins it to the edge. */}
              {((to - from) / 100) * width >= 36 ? (
                <span className="absolute top-2 -translate-x-1/2" style={{ left: `${(from + to) / 2}%` }}>
                  {yr}
                </span>
              ) : (
                <span className={cn("absolute top-2", from === 0 ? "left-0" : "right-0")}>
                  {edgeYear(yr, years[from === 0 ? i + 1 : i - 1], from === 0, width)}
                </span>
              )}
            </span>
          ))}
        </div>
        <span />

        {/* Periods: shifts that took months rather than a day */}
        {periods.length > 0 && (
          <>
            <div className="relative mt-3" style={{ height: laneEnds.length * 24 }}>
              {periods.map((p) => {
                const m = p.entries[0].m;
                return (
                  <MilestoneLink
                    key={p.key}
                    url={m.url}
                    aria-label={`${m.title}, ${monthYear(m.at, timeZone)} to ${monthYear(m.end!, timeZone)}`}
                    {...opener(p.key)}
                    className={cn(
                      "absolute h-5 whitespace-nowrap rounded-md px-1.5 text-left text-[11px] font-medium leading-5 transition-colors",
                      active === p.key ? "bg-gray-900/15 text-gray-900" : "bg-gray-900/[0.06] text-gray-600 hover:bg-gray-900/10",
                    )}
                    style={{ left: `${p.from}%`, width: `max(${p.to - p.from}%, 8px)`, top: p.lane * 24 }}
                  >
                    {room(p) >= m.label.length * LABEL_CHAR_PX + LABEL_GAP_PX + 12 ? m.label : null}
                  </MilestoneLink>
                );
              })}
            </div>
            <span />
          </>
        )}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-gray-400" />
          {baseLabel} average (1×)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] bg-white shadow-sm ring-1 ring-gray-900/15" />
          milestone, by publisher
        </span>
        {periods.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-gray-900/10" />
            period
          </span>
        )}
      </figcaption>
    </figure>
  );
}

const WEEK = 7 * DAY;
/** How far past a moment its card looks: one quarter, the window the long-run level trails. */
const AFTER_WEEKS = 13;
/** Moments closer than this share a marker. */
const MARKER_PX = 26;
/** Rough width of a label character at 11px, for fitting names without measuring them. */
const LABEL_CHAR_PX = 6.2;
const LABEL_GAP_PX = 12;

/**
 * A year pinned to the axis edge, shortened to ’22 when the full year would run
 * into its neighbour's centred label on a narrow screen.
 */
function edgeYear(yr: number, next: { from: number; to: number } | undefined, left: boolean, width: number) {
  if (!next) return yr;
  const center = (((next.from + next.to) / 2) / 100) * width;
  const free = left ? center - LABEL_CHAR_PX * 2 : width - center - LABEL_CHAR_PX * 2;
  return free - LABEL_GAP_PX >= LABEL_CHAR_PX * 4 ? yr : `’${String(yr).slice(2)}`;
}

type MilestoneEntry = {
  m: Milestone;
  from: LongRun["history"][number];
  to: LongRun["history"][number];
  weeks: number;
};

/** A link when the milestone has a source, a button when it doesn't, so both open the card. */
function MilestoneLink({
  url,
  children,
  ...props
}: { url?: string; children?: React.ReactNode } & React.HTMLAttributes<HTMLElement> & { tabIndex?: number }) {
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ) : (
    <button type="button" {...props}>
      {children}
    </button>
  );
}

function MilestoneCard({
  entries,
  left,
  top,
  day,
  timeZone,
}: {
  entries: MilestoneEntry[];
  left: number;
  top: number;
  day: (t: number) => string;
  timeZone?: string;
}) {
  const head = entries[0].m;
  const from = entries[0].from;
  const to = entries[entries.length - 1].to;
  const weeks = entries[entries.length - 1].weeks;
  const change = Math.round((to.level / from.level - 1) * 100);
  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute z-20 w-72 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-900/10",
        left > 65 ? "-translate-x-full" : left < 35 ? "" : "-translate-x-1/2",
        top < 50 ? "mt-5" : "-mt-5 -translate-y-full",
      )}
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      {head.image ? (
        <Image src={`${BASE_PATH}${head.image}`} alt="" width={576} height={192} className="aspect-[3/1] w-full object-cover" />
      ) : (
        <div className="relative flex aspect-[3/1] flex-col justify-between overflow-hidden bg-gray-950 p-3.5">
          <span
            aria-hidden
            className="absolute -right-10 -top-12 size-40 rounded-full bg-white/25 blur-3xl"
          />
          {head.source ? <SourceLogo source={head.source} className="relative size-7 rounded-md ring-1 ring-white/20" /> : <span />}
          <span className="relative font-serif text-2xl leading-none text-white">
            {entries.map((e) => e.m.label).join(" · ")}
          </span>
        </div>
      )}
      <div className="divide-y divide-gray-900/10 px-3.5">
        {entries.map(({ m }) => (
          <div key={m.id} className="py-3">
            <p className="text-[11px] text-gray-500">
              {m.source && `${sourceLabel(m.source)} · `}
              {m.end ? `${monthYear(m.at, timeZone)} – ${monthYear(m.end, timeZone)}` : day(m.at)}
            </p>
            {m.title !== m.label && <p className="mt-1 text-sm font-medium leading-snug text-gray-900">{m.title}</p>}
            <p className="mt-1.5 text-xs leading-relaxed text-gray-600">{m.why}</p>
          </div>
        ))}
        <p className="flex items-baseline justify-between gap-2 py-2.5 text-xs text-gray-600 tabular-nums">
          <span>
            Index <span className="font-semibold text-gray-900">{fmtMultiple(from.level / 100)}</span> →{" "}
            <span className="font-semibold text-gray-900">{fmtMultiple(to.level / 100)}</span>
          </span>
          <span>
            {change >= 0 ? "+" : "−"}
            {Math.abs(change)}% in {weeks} wk{weeks === 1 ? "" : "s"}
          </span>
        </p>
      </div>
    </div>
  );
}

function fmtMultiple(r: number) {
  return `${r >= 10 ? Math.round(r) : r.toFixed(1)}×`;
}

function fmtAvg(n: number) {
  return n >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, "");
}

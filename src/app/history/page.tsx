import type { Metadata } from "next";
import { SourceLogo } from "@/components/feed/source-logo";
import { TOPIC_LABEL, sourceLabel } from "@/components/feed/feed-utils";
import { getCoverage, getFeed, getFomoIndex, getUpdatedAt } from "@/lib/dataset";
import { BANDS, bandFor, biggestWeeks, type Band } from "@/lib/fomo-index";
import { REPO } from "@/lib/site";
import { cn } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "/history",
  "Historical reconstruction · AI FOMO Index",
  "The AI FOMO Index for every week since late 2022, and the biggest weeks with the stories behind them.",
);

const TONE: Record<Band["id"], { text: string; dot: string; band: string }> = {
  chill: { text: "text-sky-800", dot: "bg-sky-500", band: "fill-sky-500/[0.06]" },
  aware: { text: "text-emerald-800", dot: "bg-emerald-600", band: "fill-emerald-500/[0.06]" },
  anxious: { text: "text-amber-800", dot: "bg-amber-600", band: "fill-amber-500/[0.08]" },
  fomo: { text: "text-rose-800", dot: "bg-rose-600", band: "fill-rose-500/[0.08]" },
};

const fmtDay = (t: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(t);
const fmtMonth = (t: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "numeric" }).format(t);

export default async function HistoryPage() {
  const items = await getFeed();
  const updatedAt = await getUpdatedAt(items);
  const [fomo, coverage] = await Promise.all([getFomoIndex(items, updatedAt), getCoverage()]);
  const { history } = fomo;
  const peaks = biggestWeeks(items, history, coverage, 10);

  if (history.length < 2) {
    return <main className="mx-auto max-w-3xl px-4 py-16 text-gray-700">Not enough history yet.</main>;
  }

  // Chart geometry. Paths stretch to the box; labels are HTML placed by percent.
  const W = 1000;
  const H = 240;
  const first = history[0]!.at;
  const last = history[history.length - 1]!.at;
  const x = (t: number) => ((t - first) / (last - first)) * W;
  const y = (v: number) => H - (v / 100) * H;
  const line = `M${history.map((h) => `${x(h.at).toFixed(1)},${y(h.score).toFixed(1)}`).join("L")}`;
  const years: number[] = [];
  for (let yr = new Date(first).getUTCFullYear() + 1; Date.UTC(yr, 0, 1) < last; yr++) years.push(Date.UTC(yr, 0, 1));
  const bands = [...BANDS].reverse().map((b, i, all) => ({ band: b, lo: b.min, hi: all[i + 1]?.min ?? 100 }));
  const mean = Math.round(history.reduce((s, h) => s + h.score, 0) / history.length);
  const fullFomoDays = history.filter((h) => h.score >= 75).length;

  return (
    <main className="mx-auto max-w-5xl overflow-x-clip px-4 pb-20 pt-8 sm:px-6">
      <header>
        <h1 className="font-serif text-4xl leading-tight text-gray-900 sm:text-5xl">Historical reconstruction</h1>
        <p className="mt-3 text-lg leading-snug text-gray-700">
          The AI FOMO Index for each day since {fmtMonth(first)}. 50 is the reference level. Higher readings mean more activity in the tracked news corpus relative to its recent baseline. These are retrospective calculations, not observations recorded in real time.
        </p>
      </header>

      <dl className="mt-8 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">
        {[
          ["Days tracked", history.length.toLocaleString("en-US")],
          ["Average", String(mean)],
          ["Days at 75+", String(fullFomoDays)],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-2xl bg-gray-50 px-3 py-3 sm:px-4">
            <dt className="text-xs text-gray-500">{k}</dt>
            <dd className="mt-0.5 text-xl tabular-nums text-gray-900 sm:text-2xl">{v}</dd>
          </div>
        ))}
      </dl>

      <figure className="mt-8 overflow-x-clip pt-2">
        <div className="relative h-64 w-full sm:h-80">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img"
            aria-label={`AI FOMO Index from ${fmtDay(first)} to ${fmtDay(last)}. Highest: ${peaks[0]?.reading.score ?? "n/a"}.`}>
            {bands.map(({ band, lo, hi }) => (
              <rect key={band.id} x={0} width={W} y={y(hi)} height={y(lo) - y(hi)} className={TONE[band.id].band} />
            ))}
            <line x1={0} x2={W} y1={y(50)} y2={y(50)} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" className="stroke-gray-300" />
            {years.map((t) => (
              <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={H} vectorEffect="non-scaling-stroke" className="stroke-gray-200" />
            ))}
            <path d={line} fill="none" strokeWidth={1.25} strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="stroke-gray-800" />
          </svg>
          {peaks.map((p, i) => (
            <a
              key={p.reading.at}
              href={`#week-${i + 1}`}
              className={cn(
                "absolute flex size-5 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white",
                TONE[p.reading.band.id].dot,
              )}
              style={{ left: `${(x(p.reading.at) / W) * 100}%`, top: `calc(${(y(p.reading.score) / H) * 100}% - 4px)` }}
              aria-label={`Peak ${i + 1}: ${p.reading.score} on ${fmtDay(p.reading.at)}`}
            >
              {i + 1}
            </a>
          ))}
          {/* The start year gets a label at the left edge, since it has no Jan 1 line. */}
          <span className="absolute bottom-1 left-0 pl-1 text-[11px] text-gray-500">{new Date(first).getUTCFullYear()}</span>
          {years.map((t, i) => (
            <span
              key={t}
              className={cn(
                "absolute bottom-1 pl-1 text-[11px] text-gray-500",
                // On narrow screens a year line this close to the edge would overlap the start label.
                i === 0 && x(t) / W < 0.08 && "hidden sm:inline",
              )}
              style={{ left: `${(x(t) / W) * 100}%` }}
            >
              {new Date(t).getUTCFullYear()}
            </span>
          ))}
        </div>
        <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          {[...BANDS].reverse().map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", TONE[b.id].dot)} />
              {b.label} {b.min}+
            </span>
          ))}
          <span>Dashed line: reference level (50)</span>
        </figcaption>
      </figure>

      <section className="mt-14" aria-labelledby="biggest">
        <h2 id="biggest" className="font-serif text-3xl text-gray-900">Highest-scoring windows</h2>
        <p className="mt-2 text-gray-600">The ten highest readings, at least four weeks apart, with illustrative headlines. These examples are not independent validation or causal explanations.</p>
        <ol className="mt-6 space-y-4">
          {peaks.map((p, i) => {
            const band = bandFor(p.reading.score);
            const spike = p.reading.signals.find((s) => s.id === "spike")?.topic;
            return (
              <li key={p.reading.at} id={`week-${i + 1}`} className="scroll-mt-6 rounded-3xl bg-gray-50 p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold tabular-nums text-gray-400">#{i + 1}</span>
                  <span className={cn("font-serif text-4xl tabular-nums leading-none", TONE[band.id].text)}>{p.reading.score}</span>
                  <span className={cn("text-sm font-medium", TONE[band.id].text)}>{band.label}</span>
                  <span className="text-sm text-gray-600">week ending {fmtDay(p.reading.at)}</span>
                  {spike && <span className="text-sm text-gray-500">· biggest topic: {TOPIC_LABEL[spike] ?? spike}</span>}
                </div>
                <ul className="mt-4 space-y-2">
                  {p.drivers.map((d) => (
                    <li key={d.id} className="flex min-w-0 items-start gap-2 text-[15px] leading-snug">
                      <SourceLogo source={d.publisher} className="mt-0.5" />
                      <span className="min-w-0 break-words">
                        <a href={d.url} className="text-gray-900 underline-offset-2 hover:underline" rel="noopener">
                          {d.title}
                        </a>
                        <span className="ml-2 text-xs text-gray-500">
                          {sourceLabel(d.publisher)}
                          {d.points !== undefined && ` · ${d.points.toLocaleString("en-US")} points on HN`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>

      <p className="mt-12 text-sm leading-relaxed text-gray-600">
        History before the live crawler started was rebuilt from whatever archive each source exposes (feeds, sitemaps,
        the Hacker News search API) with the same rules the crawler uses. Those archives are not audited for
        completeness, and some have visible gaps; see{" "}
        <a className="underline underline-offset-2" href={`${REPO}/blob/main/data/README.md#known-coverage-gaps`}>known coverage gaps</a>. A
        source only counts once it has been tracked for a full month, so adding one never shows up as a spike.{" "}
        <a className="underline underline-offset-2" href={`${REPO}/blob/main/docs/fomo-index.md`}>Methodology →</a>
      </p>
    </main>
  );
}

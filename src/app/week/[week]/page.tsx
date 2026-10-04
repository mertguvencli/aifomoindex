import type { Metadata } from "next";
import Link from "next/link";
import { getWeekReadings } from "@/lib/dataset";
import { bandFor, type Band } from "@/lib/fomo-index";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { weekCardPath, weekLabel, weekPath } from "@/lib/weeks";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getWeekReadings()).map(({ week }) => ({ week }));
}

type Props = { params: Promise<{ week: string }> };

const fmtDay = (t: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(t);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { week } = await params;
  const w = (await getWeekReadings()).find((r) => r.week === week)!;
  const band = bandFor(w.score);
  const base = pageMetadata(
    weekPath(week),
    `${weekLabel(week)} · AI FOMO Index`,
    `The AI FOMO Index read ${w.score}/100 (${band.label}) in ${weekLabel(week)}. ${band.verdict}`,
  );
  return {
    ...base,
    // A snapshot for sharing; the home page is the page to rank.
    robots: { index: false, follow: true },
    openGraph: {
      ...base.openGraph,
      images: [{ url: weekCardPath(week), width: 1200, height: 630, alt: `AI FOMO Index, ${weekLabel(week)}: ${w.score}` }],
    },
  };
}

const TONE: Record<Band["id"], { wash: string; text: string }> = {
  chill: { wash: "from-sky-300/30", text: "text-sky-800" },
  aware: { wash: "from-emerald-300/30", text: "text-emerald-800" },
  anxious: { wash: "from-amber-300/40", text: "text-amber-800" },
  fomo: { wash: "from-rose-300/40", text: "text-rose-800" },
};

export default async function WeekPage({ params }: Props) {
  const { week } = await params;
  const w = (await getWeekReadings()).find((r) => r.week === week)!;
  const band = bandFor(w.score);
  const tone = TONE[band.id];
  const delta = w.weekAgo === undefined ? null : w.score - w.weekAgo;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <div className={cn("rounded-3xl bg-gradient-to-b to-white p-6 sm:p-8", tone.wash)}>
        <h1 className="text-sm font-medium uppercase tracking-[0.14em] text-gray-600">{weekLabel(week)}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {w.open ? `Week in progress · latest reading ${fmtDay(w.at)}` : `Reading of ${fmtDay(w.at)}`}
        </p>

        <div className="mt-6 flex items-end gap-6">
          <span className="font-serif text-8xl leading-none text-gray-900 tabular-nums">{w.score}</span>
          <div className="pb-2">
            <p className={cn("font-serif text-3xl leading-tight", tone.text)}>{band.label}</p>
            {delta !== null && (
              <p className={cn("mt-1 text-sm font-medium tabular-nums", delta >= 0 ? "text-rose-700" : "text-emerald-700")}>
                {delta === 0 ? "No change" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)}`} vs the week before
              </p>
            )}
          </div>
        </div>

        <p className="mt-6 text-lg leading-snug text-gray-900">{band.verdict}</p>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          Exploratory news activity, not a measure of AI progress or personal anxiety.
        </p>
      </div>

      <p className="mt-6 flex gap-4 text-sm">
        <Link href="/" className="text-gray-900 underline underline-offset-4 hover:text-gray-600">
          See the current reading
        </Link>
        <Link href="/history" className="text-gray-600 underline underline-offset-4 hover:text-gray-900">
          Full history
        </Link>
      </p>
    </main>
  );
}

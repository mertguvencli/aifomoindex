import { getWeekReadings } from "@/lib/dataset";
import { ogCard } from "@/lib/og-card";
import { weekLabel } from "@/lib/weeks";

// One card per week, at its own URL, so a shared week keeps showing that week.
// Kept outside /week/ so no folder shadows a week's .html page on GitHub Pages.
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getWeekReadings()).map(({ week }) => ({ file: `${week}.png` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const week = (await params).file.replace(/\.png$/, "");
  const w = (await getWeekReadings()).find((r) => r.week === week)!;
  return ogCard({ score: w.score, weekAgo: w.weekAgo, at: w.at, history: w.history, kicker: weekLabel(week) });
}

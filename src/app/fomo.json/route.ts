import { getFeed, getFomoIndex, getUpdatedAt } from "@/lib/dataset";
import { METHOD_VERSION } from "@/lib/fomo-index";
import { REPO } from "@/lib/site";

// Emitted as a static file by `output: "export"`: the public API for the index.
export const dynamic = "force-static";

export async function GET() {
  const items = await getFeed();
  const fomo = await getFomoIndex(items, await getUpdatedAt(items));
  const { now, weekAgo, history, drivers, longRun } = fomo;
  return Response.json({
    schemaVersion: "1.2.0",
    methodVersion: METHOD_VERSION,
    status: "exploratory",
    construct: "Relative activity in a selected AI-news corpus",
    score: now.score,
    band: now.band.id,
    label: now.band.label,
    verdict: now.band.verdict,
    weekAgo: weekAgo ?? null,
    asOf: new Date(now.at).toISOString(),
    signals: [...now.signals, now.jobs].map(({ id, label, score, current, baseline, weight, topic }) => ({
      id,
      label,
      score,
      current,
      baseline: Math.round(baseline * 10) / 10,
      weight,
      ...(topic && { topic }),
    })),
    drivers: drivers.map(({ title, url, source }) => ({ title, url, source })),
    history: history.map((h) => ({ date: new Date(h.at).toISOString().slice(0, 10), score: h.score, jobs: h.jobs })),
    longRun: longRun
      ? {
          score: longRun.score,
          band: longRun.band.id,
          level: longRun.level,
          reference: { from: new Date(longRun.baseFrom).toISOString().slice(0, 10), to: new Date(longRun.baseTo).toISOString().slice(0, 10) },
          signals: longRun.signals.map(({ id, label, current, base, ratio }) => ({
            id,
            label,
            perWeek: Math.round(current * 10) / 10,
            referencePerWeek: Math.round(base * 10) / 10,
            ratio: Math.round(ratio * 100) / 100,
          })),
          history: longRun.history.map((h) => ({ date: new Date(h.at).toISOString().slice(0, 10), score: h.score, level: h.level })),
        }
      : null,
    methodology: `${REPO}/blob/main/docs/fomo-index.md`,
  });
}

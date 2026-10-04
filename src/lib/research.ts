import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FeedItem } from "./dataset";
import { METHOD_VERSION, readingAt, type Coverage, type FomoIndex } from "./fomo-index";

const DAY = 86_400_000;

/** Deterministic, local perturbations. This is not a statistical confidence interval. */
export function researchDiagnostics(items: FeedItem[], fomo: FomoIndex, coverage: Coverage) {
  const at = fomo.now.at;
  const window = items.filter((it) => it.ts > at - 7 * DAY && it.ts <= at);
  const sources = [...new Set(items.map((it) => it.source))].sort().map((id) => ({
    id,
    total: items.filter((it) => it.source === id).length,
    current: window.filter((it) => it.source === id).length,
    eligible: (coverage.sources[id] ?? Infinity) <= at - 35 * DAY,
    coverageFrom: coverage.sources[id] === undefined ? null : new Date(coverage.sources[id]).toISOString(),
  }));
  const signals = fomo.now.signals;
  const scenarios = [
    { id: "baseline", kind: "baseline", label: "Published weights", score: fomo.now.score },
    { id: "equal", kind: "weights", label: "Equal signal weights", score: Math.round(signals.reduce((sum, s) => sum + s.score, 0) / signals.length) },
    ...signals.map((omitted) => {
      const kept = signals.filter((s) => s.id !== omitted.id);
      return {
        id: `signal-${omitted.id}`, kind: "signal", label: `Without ${omitted.label.toLowerCase()}`,
        score: Math.round(kept.reduce((sum, s) => sum + s.score * s.weight, 0) / kept.reduce((sum, s) => sum + s.weight, 0)),
      };
    }),
    ...sources.filter((s) => s.eligible).map((source) => ({
      id: `source-${source.id}`, kind: "source", label: source.id,
      score: readingAt(items.filter((it) => it.source !== source.id), at, coverage).score,
    })),
  ];
  return {
    sources,
    currentStories: window.length,
    eligibleStories: window.filter((it) => (coverage.sources[it.source] ?? Infinity) <= at - 35 * DAY).length,
    scenarios,
    sensitivityRange: { min: Math.min(...scenarios.map((s) => s.score)), max: Math.max(...scenarios.map((s) => s.score)) },
  };
}

/** A stale annotation snapshot must never imply coverage of a newer corpus. */
async function semanticStatus() {
  const base = { affectsIndex: false, protocol: "jev-headlines-v1", annotated: 0, total: 0, flagged: 0, models: [] as string[] };
  let raw: string;
  try { raw = await readFile(join(process.cwd(), "data/semantic/summary.json"), "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...base, status: "not-run" }; throw error; }
  const summary = JSON.parse(raw);
  const corpus = JSON.parse(await readFile(join(process.cwd(), "data/index.json"), "utf8"));
  const digest = createHash("sha256").update(JSON.stringify(corpus)).digest("hex");
  if (summary.datasetSha256 !== digest) return { ...base, total: corpus.length, status: "stale-snapshot" };
  if (!Number.isInteger(summary.annotated) || summary.annotated < 0 || summary.annotated > corpus.length || summary.total !== corpus.length) throw new Error("Invalid semantic coverage summary");
  return { ...base, status: summary.annotated === corpus.length ? "annotated-unvalidated" : "partial-unvalidated", annotated: summary.annotated as number, total: corpus.length as number, flagged: (summary.flagged ?? 0) as number, models: summary.models as string[] };
}

export async function getResearchSnapshot(items: FeedItem[], fomo: FomoIndex, coverage: Coverage) {
  if (!items.length || !Number.isFinite(fomo.now.at) || fomo.now.at <= 0) {
    throw new Error("Research snapshot requires a non-empty dataset and a valid observation timestamp.");
  }
  const files = ["data/index.json", "data/seen.json", "data/coverage.json", "src/lib/fomo-index.ts", "src/lib/taxonomy.ts", "src/lib/dataset.ts", "src/lib/research.ts"];
  const hashes = await Promise.all(files.map(async (file) => ({
    file, sha256: createHash("sha256").update(await readFile(join(process.cwd(), file))).digest("hex"),
  })));
  return {
    schemaVersion: "1.0.0",
    methodVersion: METHOD_VERSION,
    status: "exploratory" as const,
    construct: "Relative activity in a selected AI-news corpus",
    asOf: new Date(fomo.now.at).toISOString(),
    timestampBasis: "Most recent first-seen timestamp in the dataset; not a crawler health check",
    score: fomo.now.score,
    totalStories: items.length,
    historyDays: fomo.history.length,
    hashes,
    ...researchDiagnostics(items, fomo, coverage),
    sensitivityInterpretation: "Range across specified perturbations of this snapshot, not a confidence interval or exhaustive uncertainty analysis",
    semanticLayer: await semanticStatus(),
  };
}

export type ResearchSnapshot = Awaited<ReturnType<typeof getResearchSnapshot>>;

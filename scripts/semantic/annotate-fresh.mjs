/**
 * jev-excerpts-v2: annotate items with their headline and source excerpt. Runs
 * inside the crawl (and the one-off backfill-jev), the only moments the excerpt
 * is in memory; the journal keeps its hash and length, never its text. A crawl
 * attempts each item once, so a failure is recorded and left missing.
 */
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PROTOCOL_V2, RUBRIC_HASH_V2, QUESTIONS_V2, OPENROUTER_MODEL, requestForV2, hash, validateResponse, responseWarnings, evaluate } from "./jev.mjs";

/** `mode` is "crawl" (prospective) or "backfill" (retrospective: page text may have changed since publication). */
export async function annotateFresh({ items, directory, apiKey, concurrency = 4, mode = "crawl", evaluator = evaluate }) {
  if (!items.length) return { annotated: 0, failed: 0 };
  if (!apiKey) {
    console.log("  no OPENROUTER_KEY; skipping Jev v2 annotations");
    return { annotated: 0, failed: 0, skipped: items.length };
  }
  await mkdir(resolve(directory, "protocols"), { recursive: true });
  await writeFile(resolve(directory, "protocols", `${RUBRIC_HASH_V2}.json`), JSON.stringify({ protocol: PROTOCOL_V2, model: OPENROUTER_MODEL, rubricSha256: RUBRIC_HASH_V2, questions: QUESTIONS_V2 }, null, 2) + "\n");
  const journal = resolve(directory, "annotations.jsonl");
  let cursor = 0, annotated = 0, failed = 0;
  let writes = Promise.resolve();
  const append = (file, row) => (writes = writes.then(() => appendFile(resolve(directory, file), JSON.stringify(row) + "\n")));
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      let request;
      try {
        request = requestForV2(item);
        const startedAt = new Date().toISOString();
        const { raw } = await evaluator(request, apiKey);
        validateResponse(raw, request);
        const excerpt = request.state.excerpt;
        await append("annotations.jsonl", {
          protocol: PROTOCOL_V2, rubricSha256: RUBRIC_HASH_V2, id: item.id, inputSha256: hash(request),
          excerptSha256: excerpt ? hash(excerpt) : null, excerptChars: excerpt?.length ?? 0,
          mode, ...(item.fetch && { fetch: item.fetch }), requestedModel: OPENROUTER_MODEL, warnings: responseWarnings(raw), startedAt, completedAt: new Date().toISOString(), response: raw,
        });
        annotated++;
      } catch (error) {
        failed++;
        await append("failures.jsonl", { id: item.id, inputSha256: request ? hash(request) : null, at: new Date().toISOString(), error: String(error), response: error.rawResponse });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  await writes;

  const rows = (await readFile(journal, "utf8").catch(() => "")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const counts = (key) => Object.fromEntries([...new Set(rows.map((r) => r.response.answers[key].choice))].sort().map((label) => [label, rows.filter((r) => r.response.answers[key].choice === label).length]));
  const summary = {
    protocol: PROTOCOL_V2, rubricSha256: RUBRIC_HASH_V2, updatedAt: new Date().toISOString(),
    annotated: rows.length, withExcerpt: rows.filter((r) => r.excerptChars > 0).length,
    byMode: Object.fromEntries(["crawl", "backfill"].map((m) => [m, rows.filter((r) => (r.mode ?? "crawl") === m).length])),
    models: [...new Set(rows.map((r) => r.response.model))].sort(), flagged: rows.filter((r) => r.warnings.length > 0).length,
    relevance: counts("relevance"), concreteChange: counts("concreteChange"), significance: counts("significance"),
    recordedCostUsd: rows.reduce((sum, r) => sum + (r.response.usage.cost ?? 0), 0),
    note: "Headline plus source excerpt; excerpts are not stored. crawl rows are prospective; backfill rows are retrospective, from pages fetched later. No human accuracy benchmark; zero index weight.",
  };
  const target = resolve(directory, "summary.json");
  await writeFile(target + ".tmp", JSON.stringify(summary, null, 2) + "\n");
  await rename(target + ".tmp", target);
  console.log(`  Jev v2: annotated ${annotated}, failed ${failed}`);
  return { annotated, failed };
}

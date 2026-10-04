/** Offline by default. Explicit --execute enables bounded, sequential API calls. */
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PROTOCOL, MODEL, OPENROUTER_MODEL, ENDPOINT, OPENROUTER_ENDPOINT, RUBRIC_HASH, hash, requestFor, selectSample, evaluate } from "./semantic/jev.mjs";

// Native parsing never executes shell expressions from .env.
try { process.loadEnvFile(".env"); } catch (error) { if (error.code !== "ENOENT") throw error; }

async function main() {
  const args = process.argv.slice(2);
  const allowed = /^(--execute|--provider=(?:typesafe|openrouter)|--limit=\d+|--days=\d+|--out=.+|--model=.+)$/;
  if (args.some((arg) => !allowed.test(arg))) throw new Error("Usage: npm run semantic:pilot -- [--limit=20] [--days=35] [--out=path] [--model=jev-1.13.0] [--execute]");
  const value = (key, fallback) => args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
  const limit = Number(value("limit", "20")), days = Number(value("days", "35"));
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isInteger(days) || days < 1 || days > 1460) throw new Error("Use 1–500 records and 1–1460 days.");
  const execute = args.includes("--execute");
  const provider = value("provider", "typesafe");
  const apiKey = provider === "openrouter" ? (process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY) : process.env.TYPESAFE_API_KEY;
  if (execute && !apiKey) throw new Error(`${provider} API key is missing. Use the default offline mode to inspect requests.`);
  const model = value("model", provider === "openrouter" ? OPENROUTER_MODEL : MODEL);
  if ((provider === "openrouter") !== (model === OPENROUTER_MODEL)) throw new Error("Model and provider do not match.");
  const raw = await readFile("data/index.json", "utf8");
  const seenRaw = await readFile("data/seen.json", "utf8");
  const items = JSON.parse(raw);
  const times = Object.values(JSON.parse(seenRaw)).map(Date.parse).filter(Number.isFinite);
  if (!times.length) throw new Error("No observation timestamp in seen.json.");
  const asOf = Math.max(...times);
  const sample = selectSample(items, asOf, days, limit);
  if (!sample.length) throw new Error("No records in the selected window.");
  const plan = {
    protocol: PROTOCOL, rubricSha256: RUBRIC_HASH, model, provider, endpoint: provider === "openrouter" ? OPENROUTER_ENDPOINT : ENDPOINT, execute,
    datasetSha256: hash(raw), seenSha256: hash(seenRaw), asOf: new Date(asOf).toISOString(), days,
    sampling: "Deterministic hash ordering within source; round-robin across sources. Audit pilot, not representative prevalence.",
    requested: limit, selected: sample.length,
    records: sample.map((it) => {
      const request = requestFor(it, model);
      return { id: it.id, source: it.source, url: it.url, inputSha256: hash(request), request };
    }),
  };
  const out = resolve(value("out", `experiments/runs/${new Date().toISOString().replace(/[:.]/g, "-")}`));
  // Never overwrite an earlier experiment. Its exact inputs are part of the record.
  await mkdir(resolve(out, ".."), { recursive: true });
  await mkdir(out);
  await writeFile(resolve(out, "plan.json"), JSON.stringify(plan, null, 2) + "\n");
  await writeFile(resolve(out, "human-labels.json"), JSON.stringify(sample.map((it) => ({
    id: it.id, title: it.title, publishedAt: it.publishedAt,
    annotator: null, relevance: null, concreteChange: null, specificity: null,
  })), null, 2) + "\n");
  console.log(`${execute ? "Executing" : "Offline plan"}: ${sample.length} records, ${model}. ${out}`);
  if (!execute) { console.log("No network requests made. Add --execute with the selected provider key set to run this pilot."); return; }
  let completed = 0;
  for (const record of plan.records) {
    const startedAt = new Date().toISOString();
    try {
      const { raw: response } = await evaluate(record.request, apiKey);
      await appendFile(resolve(out, "results.jsonl"), JSON.stringify({
        protocol: PROTOCOL, rubricSha256: RUBRIC_HASH, id: record.id, inputSha256: record.inputSha256,
        startedAt, completedAt: new Date().toISOString(), response,
      }) + "\n");
      completed++;
    } catch (error) {
      if (error.rawResponse) await writeFile(resolve(out, "invalid-response.json"), JSON.stringify(error.rawResponse, null, 2));
      await writeFile(resolve(out, "failure.json"), JSON.stringify({ id: record.id, completed, planned: sample.length, error: String(error), at: new Date().toISOString() }, null, 2));
      throw error;
    }
  }
  console.log(`Saved ${completed} validated responses. These experimental outputs do not alter the published index.`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });

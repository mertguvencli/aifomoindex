import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { annotateFresh } from "../scripts/semantic/annotate-fresh.mjs";
import { QUESTIONS, QUESTIONS_V2, RUBRIC_HASH, cleanExcerpt, requestForV2 } from "../scripts/semantic/jev.mjs";

const excerpt = "Acme releases <b>Model X</b>, a 40B open-weight model with a 1M-token context.";
const item = { id: "a", title: "Acme releases Model X", publishedAt: "2026-10-04T00:00:00Z", source: "acme", url: "https://acme.test/x", score: 500, rawContent: excerpt };
const choice = (labels, pick) => ({ type: "choice", choice: pick, confidence: 1, probabilities: Object.fromEntries(labels.map((l) => [l, l === pick ? 1 : 0])) });
function response() {
  return { model: "typesafe/jev-1.13-20260917", answers: {
    relevance: choice(["relevant", "unrelated", "insufficient"], "relevant"),
    concreteChange: choice(["reported", "commentary", "insufficient"], "reported"),
    specificity: { type: "score", score: 2, confidence: 1, probabilities: { 0: 0, 1: 0, 2: 1 }, legend: Object.fromEntries(QUESTIONS.specificity.criteria.map((x, i) => [i, x])) },
    significance: choice(["major", "minor", "insufficient"], "major"),
  }, usage: { input_tokens: 900, output_tokens: 120, cost: 0.00004 } };
}

test("v2 state carries the cleaned excerpt but no source, URL or popularity; v1 rubric is unchanged", () => {
  const request = requestForV2(item);
  assert.deepEqual(Object.keys(request.state).sort(), ["excerpt", "headline", "publishedAt"]);
  assert.equal(request.state.excerpt, "Acme releases Model X , a 40B open-weight model with a 1M-token context.");
  assert.equal(request.questions, QUESTIONS_V2);
  assert.equal(RUBRIC_HASH, "458511b04141142d9110a514e626adb9bb502d516148bbb1aed7f4fa18d3f321");
  assert.equal(cleanExcerpt(" acme releases model x ", item.title), "");
  assert.equal(cleanExcerpt("x".repeat(5000), item.title).length, 1500);
  assert.ok(!("excerpt" in requestForV2({ ...item, rawContent: undefined }).state));
});

test("journal keeps the excerpt hash, never its text; failures are recorded without stopping other items", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jev-v2-"));
  try {
    const items = [item, { ...item, id: "b", rawContent: undefined }, { ...item, id: "c" }];
    const result = await annotateFresh({ items, directory, apiKey: "test", concurrency: 1, evaluator: async () => ({ raw: response() }) });
    assert.deepEqual(result, { annotated: 3, failed: 0 });
    const journal = await readFile(join(directory, "annotations.jsonl"), "utf8");
    assert.ok(!journal.includes("open-weight"));
    const rows = journal.trim().split("\n").map(JSON.parse);
    assert.deepEqual(rows.map((r) => r.excerptChars > 0), [true, false, true]);
    assert.equal(rows[1].excerptSha256, null);

    const failing = await annotateFresh({ items: [{ ...item, id: "d" }, { ...item, id: "e" }], directory, apiKey: "test", concurrency: 1,
      evaluator: async () => { throw Object.assign(new Error("Jev HTTP 429"), { rawResponse: { error: "rate" } }); } });
    assert.deepEqual(failing, { annotated: 0, failed: 2 });
    const failures = await readFile(join(directory, "failures.jsonl"), "utf8");
    assert.ok(!failures.includes("open-weight"));
    const summary = JSON.parse(await readFile(join(directory, "summary.json"), "utf8"));
    assert.equal(summary.annotated, 3);
    assert.equal(summary.withExcerpt, 2);
    assert.deepEqual(summary.significance, { major: 3 });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("without a key nothing is called or written", async () => {
  let calls = 0;
  const result = await annotateFresh({ items: [item], directory: join(tmpdir(), "jev-v2-unused"), apiKey: undefined, evaluator: async () => { calls++; } });
  assert.equal(result.skipped, 1);
  assert.equal(calls, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { requestFor, validateResponse, evaluate, selectSample, hash, MODEL, QUESTIONS } from "../scripts/semantic/jev.mjs";

const item = { id: "one", title: "New AI model released", publishedAt: "2026-09-30T00:00:00Z", source: "openai", points: 999, importance: 5 };
const request = requestFor(item);
function response() {
  return { model: MODEL, answers: {
    relevance: { type: "choice", choice: "relevant", confidence: 0.5, probabilities: { relevant: 0.8, unrelated: 0.1, insufficient: 0.1 } },
    concreteChange: { type: "choice", choice: "reported", confidence: 0.5, probabilities: { reported: 0.8, commentary: 0.1, insufficient: 0.1 } },
    specificity: { type: "score", score: 1.2, confidence: 0.3, probabilities: { 0: 0.1, 1: 0.6, 2: 0.3 }, legend: Object.fromEntries(QUESTIONS.specificity.criteria.map((v, i) => [i, v])) },
  }, usage: { input_tokens: 400, output_tokens: 30 } };
}

test("model input omits popularity and source metadata; moving aliases are rejected", () => {
  assert.deepEqual(Object.keys(request.state).sort(), ["headline", "publishedAt"]);
  assert.throws(() => requestFor(item, "jev-latest"), /pinned/);
  assert.equal(hash(requestFor(item)), hash(request));
  assert.notEqual(hash(requestFor({ ...item, title: "Different headline" })), hash(request));
});

test("validated answers preserve distributions and uncertainty", () => {
  const raw = response();
  assert.equal(validateResponse(raw, request), raw);
  raw.answers.relevance = { type: "choice", choice: "insufficient", confidence: 0.1, probabilities: { relevant: 0.3, unrelated: 0.3, insufficient: 0.4 } };
  assert.equal(validateResponse(raw, request).answers.relevance.choice, "insufficient");
});

test("reject missing answers, invalid probabilities, rubric/model drift and inconsistent expected scores", () => {
  for (const change of [
    (r) => { delete r.answers.relevance; },
    (r) => { r.answers.relevance.probabilities.relevant = -0.2; },
    (r) => { r.answers.relevance.probabilities.relevant = 0.2; },
    (r) => { r.answers.specificity.score = 1.9; },
    (r) => { r.answers.specificity.legend[0] = "Changed"; },
    (r) => { r.model = "jev-other"; },
    (r) => { r.answers.relevance.confidence = NaN; },
  ]) { const raw = response(); change(raw); assert.throws(() => validateResponse(raw, request)); }
});

test("HTTP adapter sends one documented request and never retries or invents a fallback on error", async () => {
  let calls = 0;
  const result = await evaluate(request, "test-only", async (url, init) => {
    calls++;
    assert.equal(url, "https://api.typesafe.ai/v1/systemone");
    assert.deepEqual(JSON.parse(init.body), request);
    return new Response(JSON.stringify(response()), { status: 200 });
  });
  assert.equal(result.validated.model, MODEL);
  await assert.rejects(evaluate(request, "test-only", async () => { calls++; return new Response("rate limited", { status: 429 }); }), /429/);
  assert.equal(calls, 2);
});

test("pilot sampling is deterministic, source-balanced and bounded to the stated window", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ ...item, id: String(i), source: i < 10 ? "a" : "b" }));
  rows.push({ ...item, id: "future", publishedAt: "2026-10-02" });
  const at = Date.parse("2026-10-01");
  const a = selectSample(rows, at, 35, 4);
  assert.deepEqual(a.map((x) => x.source), ["a", "b", "a", "b"]);
  assert.deepEqual(selectSample([...rows].reverse(), at, 35, 4), a);
});

test("CLI defaults to offline, records exact inputs and refuses to overwrite a run", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "fomo-pilot-"));
  const out = join(tmp, "run");
  try {
    const args = ["scripts/semantic-pilot.mjs", "--limit=2", `--out=${out}`];
    const log = execFileSync(process.execPath, args, { encoding: "utf8" });
    assert.match(log, /No network requests/);
    const plan = JSON.parse(await readFile(join(out, "plan.json"), "utf8"));
    assert.equal(plan.execute, false);
    assert.equal(plan.records.length, 2);
    assert.equal(plan.records[0].inputSha256, hash(plan.records[0].request));
    assert.throws(() => execFileSync(process.execPath, args, { stdio: "pipe" }));
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test("OpenRouter uses its own endpoint and accepts only the requested Jev release", async () => {
  const req = requestFor(item, "typesafe/jev-1.13");
  const raw = response();
  raw.model = "typesafe/jev-1.13-20260917";
  const result = await evaluate(req, "test-only", async (url, init) => {
    assert.equal(url, "https://openrouter.ai/api/v1/systemone");
    assert.equal(init.headers.authorization, "Bearer test-only");
    return new Response(JSON.stringify(raw), { status: 200 });
  });
  assert.equal(result.validated.model, raw.model);
  raw.model = "typesafe/jev-1.14-20261001";
  assert.throws(() => validateResponse(raw, req), /model/);
  assert.throws(() => requestFor(item, "typesafe/jev-latest"), /pinned/);
});

test("accepts two-decimal rounding while retaining raw scores and rejecting larger inconsistencies", () => {
  const raw = response();
  raw.answers.specificity.probabilities = { 0: 0.43, 1: 0.57, 2: 0 };
  raw.answers.specificity.score = 0.58;
  assert.equal(validateResponse(raw, request).answers.specificity.score, 0.58);
  raw.answers.specificity.score = 0.60;
  assert.throws(() => validateResponse(raw, request), /expected score/);
});

test('retains typed provider labels but flags disagreement with probability argmax', async () => {
  const { responseWarnings } = await import('../scripts/semantic/jev.mjs');
  const raw = response();
  raw.answers.concreteChange = {type:'choice',choice:'reported',confidence:0.25,probabilities:{reported:0.49,commentary:0.50,insufficient:0.01}};
  validateResponse(raw,request);
  assert.equal(raw.answers.concreteChange.choice,'reported');
  assert.deepEqual(responseWarnings(raw).map(w=>w.code),['choice_not_argmax']);
  raw.answers.concreteChange.choice='invented';
  assert.throws(()=>validateResponse(raw,request),/Invalid choice/);
});

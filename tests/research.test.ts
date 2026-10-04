import assert from "node:assert/strict";
import test from "node:test";
import { computeFomoIndex, readingAt, bandFor, type Coverage } from "../src/lib/fomo-index";
import { researchDiagnostics } from "../src/lib/research";
import type { FeedItem } from "../src/lib/dataset";

const DAY = 86400000;
const end = Date.UTC(2026, 8, 30);
const coverage: Coverage = { historyFrom: end - 100 * DAY, sources: { hackernews: end - 100 * DAY, openai: end - 100 * DAY } };
function item(source: string, days: number, points = 250): FeedItem {
  return { id: `${source}-${days}`, title: "A model release", url: `https://example.com/${source}/${days}`, domain: "example.com", source, publisher: source, ts: end - days * DAY, topics: ["models"], entities: ["OpenAI"], importance: 3, points };
}
const steady = Array.from({ length: 100 }, (_, i) => [item("hackernews", i), item("openai", i)]).flat();

test("a stationary corpus yields the reference score for every component", () => {
  const r = readingAt(steady, end, coverage);
  assert.equal(r.score, 50);
  assert.deepEqual(r.signals.map((s) => s.score), [50, 50, 50, 50]);
});

test("open-left, closed-right windows exclude future data and count the boundary exactly once", () => {
  const rows = [item("openai", 0), item("openai", 7), item("openai", 35), item("openai", -1)];
  const velocity = readingAt(rows, end, coverage).signals[0];
  assert.equal(velocity.current, 1);
  assert.equal(velocity.baseline, 0.25);
});

test("a new source cannot inflate the index before its declared coverage spans the baseline", () => {
  const newcomer = Array.from({ length: 200 }, (_, i) => ({ ...item("new", 1), id: `new-${i}` }));
  const withNew = { ...coverage, sources: { ...coverage.sources, new: end - DAY } };
  assert.equal(readingAt([...steady, ...newcomer], end, withNew).score, readingAt(steady, end, coverage).score);
  const fomo = computeFomoIndex([...steady, ...newcomer], end, withNew);
  const d = researchDiagnostics([...steady, ...newcomer], fomo, withNew);
  assert.equal(d.sources.find((s) => s.id === "new")?.eligible, false);
  assert.equal(d.scenarios.some((s) => s.id === "source-new"), false);
  assert.equal(d.currentStories - d.eligibleStories, 200);
});

test("source ablation re-baselines all windows; signal ablation renormalizes remaining weights", () => {
  const rows = [...steady, ...Array.from({ length: 40 }, (_, i) => ({ ...item("openai", 1), id: `burst-${i}` }))];
  const fomo = computeFomoIndex(rows, end, coverage);
  const before = JSON.stringify(fomo);
  const d = researchDiagnostics(rows, fomo, coverage);
  assert.equal(d.scenarios.find((s) => s.id === "source-openai")?.score, 50);
  const kept = fomo.now.signals.filter((s) => s.id !== "velocity");
  const expected = Math.round(kept.reduce((n, s) => n + s.weight * s.score, 0) / 0.7);
  assert.equal(d.scenarios.find((s) => s.id === "signal-velocity")?.score, expected);
  assert.ok(d.sensitivityRange.min <= fomo.now.score && d.sensitivityRange.max >= fomo.now.score);
  assert.equal(JSON.stringify(fomo), before);
});

test("legacy band IDs retain their boundaries while labels describe activity", () => {
  assert.deepEqual([34, 35, 54, 55, 74, 75].map((s) => bandFor(s).id), ["chill", "aware", "aware", "anxious", "anxious", "fomo"]);
  assert.equal(bandFor(55).label, "Elevated");
});

test("the long-run level is 100 for a stationary corpus and tracks growth against the reference year", () => {
  const from = end - 500 * DAY;
  const cov: Coverage = { historyFrom: from, sources: { hackernews: from, openai: from, late: end - 10 * DAY } };
  const flat = Array.from({ length: 500 }, (_, i) => [item("hackernews", i), item("openai", i)]).flat();
  assert.equal(computeFomoIndex(flat, end, cov).longRun?.level, 100);
  assert.equal(computeFomoIndex(flat, end, cov).longRun?.score, 50);
  const late = Array.from({ length: 300 }, (_, i) => ({ ...item("late", i % 10), id: `late-${i}` }));
  assert.equal(computeFomoIndex([...flat, ...late], end, cov).longRun?.level, 100);
  const doubled = [...flat, ...flat.filter((it) => it.ts > end - 91 * DAY).map((it) => ({ ...it, id: `${it.id}-x` }))];
  const lr = computeFomoIndex(doubled, end, cov).longRun!;
  assert.ok(lr.level > 190 && lr.level <= 200, `level ${lr.level}`);
  assert.equal(lr.history.at(-1)?.level, lr.level);
  assert.ok(lr.score >= 65 && lr.score <= 67, `score ${lr.score}`);
  assert.equal(computeFomoIndex(flat, from + 300 * DAY, cov).longRun, undefined);
});

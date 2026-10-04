import assert from "node:assert/strict";
import test from "node:test";
import { isoWeek, weeklyReadings } from "../src/lib/weeks";

const DAY = 86_400_000;

test("ISO weeks follow the Thursday rule across year ends", () => {
  assert.equal(isoWeek(Date.UTC(2026, 9, 4)), "2026-W40"); // Sunday closes the week
  assert.equal(isoWeek(Date.UTC(2026, 9, 5)), "2026-W41"); // Monday opens the next
  assert.equal(isoWeek(Date.UTC(2027, 0, 1)), "2026-W53"); // Friday, still 2026's last week
  assert.equal(isoWeek(Date.UTC(2024, 11, 30)), "2025-W01"); // Monday, already 2025's first
});

test("each week keeps its last daily reading and the open week is flagged", () => {
  const start = Date.UTC(2026, 8, 21); // Monday of 2026-W39
  const history = Array.from({ length: 16 }, (_, i) => ({ at: start + i * DAY, score: i, jobs: 0 }));
  const weeks = weeklyReadings(history);
  assert.deepEqual(weeks.map((w) => [w.week, w.score, w.weekAgo, w.open]), [
    ["2026-W40", 13, 6, false],
    ["2026-W41", 15, 8, true],
  ]);
  assert.equal(weeks[0]!.history.at(-1)!.score, 13);
});

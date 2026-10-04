/**
 * Prints the index's backtest over the whole dataset: the score distribution,
 * time spent in each band, and the biggest weeks. Paste the output into
 * docs/fomo-index.md when you change the formula.
 *
 *   npx tsx scripts/backtest.ts
 */
import { getCoverage, getFeed, getFomoIndex, getUpdatedAt } from "@/lib/dataset";
import { getResearchSnapshot } from "@/lib/research";
import { BANDS, bandFor, biggestWeeks } from "@/lib/fomo-index";

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

async function main() {
  const items = await getFeed();
  const updatedAt = await getUpdatedAt(items);
  const [fomo, coverage] = await Promise.all([getFomoIndex(items, updatedAt), getCoverage()]);
  const snapshot = await getResearchSnapshot(items, fomo, coverage);
  console.log(`Method v${snapshot.methodVersion} · exploratory historical reconstruction (not real-time backtesting)\n`);
  console.log(JSON.stringify({ asOf: snapshot.asOf, hashes: snapshot.hashes, sensitivity: snapshot.scenarios }, null, 2));
  const scores = fomo.history.map((h) => h.score).sort((a, b) => a - b);
  const q = (p: number) => scores[Math.min(scores.length - 1, Math.floor(p * scores.length))];

  console.log(`## Historical reconstruction (${day(fomo.history[0]!.at)} – ${day(fomo.history.at(-1)!.at)}, ${scores.length} days)\n`);
  console.log("| min | p10 | p25 | median | p75 | p90 | max |");
  console.log("| --- | --- | --- | --- | --- | --- | --- |");
  console.log(`| ${scores[0]} | ${q(0.1)} | ${q(0.25)} | ${q(0.5)} | ${q(0.75)} | ${q(0.9)} | ${scores.at(-1)} |\n`);

  console.log("| Band | Share of days |");
  console.log("| --- | --- |");
  for (const b of BANDS) {
    const n = fomo.history.filter((h) => bandFor(h.score).id === b.id).length;
    console.log(`| ${b.label} (${b.min}+) | ${((100 * n) / scores.length).toFixed(0)}% |`);
  }

  console.log("\n| # | Week ending | Score | Top story |");
  console.log("| --- | --- | --- | --- |");
  biggestWeeks(items, fomo.history, coverage, 10).forEach((p, i) => {
    const top = p.drivers[0];
    console.log(`| ${i + 1} | ${day(p.reading.at)} | ${p.reading.score} | ${top ? `[${top.title.replace(/\|/g, "\\|")}](${top.url})` : ""} |`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

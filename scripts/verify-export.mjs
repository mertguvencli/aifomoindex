import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

// A successful Next build must also produce the files served by GitHub Pages.
// In particular, an unsupported local Node version can leave a partial export.
const pages = ["index", "about", "methodology", "history", "feed", "dashboard"];
for (const page of pages) {
  const html = await readFile(`out/${page}.html`, "utf8");
  assert.ok(html.includes("<main"), `${page} has no rendered main content`);
}
const fomo = JSON.parse(await readFile("out/fomo.json", "utf8"));
const research = JSON.parse(await readFile("out/research.json", "utf8"));
assert.equal(fomo.score, research.score);
assert.equal(fomo.asOf, research.asOf);
assert.equal(fomo.methodVersion, research.methodVersion);
assert.ok(Array.isArray(JSON.parse(await readFile("out/feed.json", "utf8"))));
JSON.parse(await readFile("out/badge.json", "utf8"));
assert.equal((await readFile("out/report.pdf")).subarray(0, 5).toString(), "%PDF-");
assert.equal((await readFile("out/og.png")).subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
const sitemap = await readFile("out/sitemap.xml", "utf8");
for (const page of ["/methodology", "/history", "/feed", "/about"]) assert.ok(sitemap.includes(`${page}</loc>`), `sitemap misses ${page}`);
assert.match(await readFile("out/robots.txt", "utf8"), /Sitemap: .*\/sitemap\.xml/);
assert.ok((await readFile("out/llms.txt", "utf8")).includes(`reads ${fomo.score}/100`), "llms.txt does not match fomo.json");
for (const page of ["index", "methodology"]) assert.ok((await readFile(`out/${page}.html`, "utf8")).includes("application/ld+json"), `${page} has no JSON-LD`);
console.log("Verified exported pages, matching research/index snapshots, PDF, PNG, sitemap, robots, llms.txt and JSON-LD.");

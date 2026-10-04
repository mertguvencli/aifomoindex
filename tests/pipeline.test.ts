import assert from "node:assert/strict";
import { test } from "node:test";
import { meta, pageTitle } from "../pipeline/src/sources/article.js";
import { articleLinks } from "../pipeline/src/sources/page.js";
import { parseFeed } from "../pipeline/src/sources/rss.js";
import { canonicalUrl, itemId } from "../pipeline/src/hash.js";
import { allowed, parseRobots } from "../pipeline/src/polite.js";
import { storyKey } from "../pipeline/src/dedup.js";

test("meta keeps an apostrophe inside a double-quoted value", () => {
  const html = `<meta property="og:title" content="How we're supporting better cyclone prediction">`;
  assert.equal(meta(html, "og:title"), "How we're supporting better cyclone prediction");
  const reversed = `<meta content='Gemini "3" > 2' name="og:title">`;
  assert.equal(meta(reversed, "og:title"), 'Gemini "3" > 2');
  assert.equal(meta(html, "description"), undefined);
});

test("feeds decode numeric entities, keep only web links and need a date", () => {
  const xml = `<rss><channel>
    <item><title>From &#34;Understanding&#34; to 100B&#43;</title><link>https://a.example/1</link><pubDate>Fri, 02 Oct 2026 16:15:00 GMT</pubDate></item>
    <item><title>Script</title><link>javascript:alert(1)</link><pubDate>Fri, 02 Oct 2026 16:15:00 GMT</pubDate></item>
    <item><title>Undated</title><link>https://a.example/2</link></item>
    <item><title>Bad date</title><link>https://a.example/3</link><pubDate>soon</pubDate></item>
  </channel></rss>`;
  const items = parseFeed(xml, "lab");
  assert.equal(items.length, 1);
  assert.equal(items[0]!.title, 'From "Understanding" to 100B+');
  assert.equal(items[0]!.publishedAt, "2026-10-02T16:15:00.000Z");
});

test("http and https links share one id, but path case is kept", () => {
  assert.equal(itemId("http://openai.com/index/x/"), itemId("https://www.openai.com/index/x"));
  assert.equal(canonicalUrl("https://github.com/Org/Repo?utm_source=hn"), "https://github.com/Org/Repo");
});

test("robots: an empty User-agent matches no one and groups for one agent combine", () => {
  const empty = parseRobots("User-agent:\nDisallow: /\n\nUser-agent: *\nDisallow: /private");
  assert.equal(allowed(empty, "/news"), true);
  assert.equal(allowed(empty, "/private/x"), false);

  const split = parseRobots("User-agent: aifomoindex-bot\nDisallow: /a\n\nUser-agent: *\nDisallow: /\n\nUser-agent: aifomoindex-bot\nDisallow: /b");
  assert.equal(allowed(split, "/a"), false);
  assert.equal(allowed(split, "/b"), false);
  assert.equal(allowed(split, "/c"), true);
});

test("a lab post republished under a new URL has the same story key", () => {
  const a = { source: "openai", title: "Offering ZDR", publishedAt: "Wed, 19 Aug 2026 10:00:00 GMT" };
  const b = { source: "openai", title: "offering zdr ", publishedAt: "2026-08-19T18:00:00Z" };
  assert.equal(storyKey(a), storyKey(b));
  assert.equal(storyKey({ ...a, source: "hackernews" }), undefined);
});

test("a title with the site name first keeps the part that holds the heading", () => {
  const prefixed = `<meta property="og:title" content="Runway Research | Introducing Praxis-1"><h1 class="x">Praxis-1</h1>`;
  assert.equal(pageTitle(prefixed), "Introducing Praxis-1");
  const suffixed = `<title>Claude Sonnet 5 \\ Anthropic</title><h1>Claude <em>Sonnet</em> 5</h1>`;
  assert.equal(pageTitle(suffixed), "Claude Sonnet 5");
  assert.equal(pageTitle(`<title>Mistral 7B | Mistral AI</title>`), "Mistral 7B");
});

test("list pages skip category pages named in exclude", () => {
  const html = `<a href="/research/publications">All</a><a href="/research/introducing-gen-4.5">Gen-4.5</a><a href="/research/a/b">Nested</a>`;
  assert.deepEqual(
    articleLinks(html, "https://runway.com/research", "/research/", ["publications"]).map((u) => new URL(u).pathname),
    ["/research/introducing-gen-4.5"],
  );
});

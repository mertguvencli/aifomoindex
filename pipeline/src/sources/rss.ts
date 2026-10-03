import { politeText } from "../polite.js";
import type { RawItem, Source } from "../types.js";
import { decode } from "./article.js";

/**
 * Intentionally dependency-free RSS/Atom reader. It is deliberately minimal —
 * good enough to bootstrap the dataset. Swap in a real XML parser when a feed
 * needs it; that is a welcome contribution.
 */
function stripTags(s: string): string {
  return decode(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, ""));
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m || m[1] === undefined) return undefined;
  return stripTags(m[1]);
}

function link(block: string): string | undefined {
  const rss = block.match(/<link>([\s\S]*?)<\/link>/i);
  const atom = block.match(/<link[^>]*href="([^"]+)"/i);
  const raw = rss?.[1] ? stripTags(rss[1]) : atom?.[1] && decode(atom[1]);
  // Only web links: a feed must not be able to plant a javascript: or data: URL.
  return raw && /^https?:\/\//i.test(raw) ? raw : undefined;
}

/** The item's date as ISO 8601, or undefined if it has none or it doesn't parse. */
function date(block: string): string | undefined {
  const raw = tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "dc:date");
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

/** Guardrail: a misconfigured URL (HTML/404 page) must not dump thousands of items. */
const MAX_ITEMS_PER_FEED = 40;

/** Parse every item in an RSS/Atom document. `limit` guards against a misconfigured URL. */
export function parseFeed(xml: string, name: string, limit = MAX_ITEMS_PER_FEED): RawItem[] {
  const blocks = (xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) ?? []).slice(0, limit);
  const items: RawItem[] = [];
  for (const b of blocks) {
    const title = tag(b, "title");
    const url = link(b);
    const publishedAt = date(b);
    // Without a date the item would be stamped "now" and fake a spike, so skip it.
    if (!title || !url || !publishedAt) continue;
    items.push({
      title,
      url,
      source: name,
      publishedAt,
      rawContent: tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content"),
    });
  }
  return items;
}

export function rssSource(name: string, feedUrl: string): Source {
  return {
    name,
    async fetch(): Promise<RawItem[]> {
      return parseFeed(await politeText(feedUrl), name);
    },
  };
}

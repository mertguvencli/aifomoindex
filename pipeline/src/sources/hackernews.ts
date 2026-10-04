import { politeFetch } from "../polite.js";
import type { RawItem, Source } from "../types.js";

const ENDPOINT = "https://hn.algolia.com/api/v1/search_by_date";
/**
 * A story matches if any of these words is in it. "AI" alone misses headlines
 * like "GPT-4" or "Building a Virtual Machine Inside ChatGPT". Changing this
 * list changes what the index counts, so re-run the backfill after editing it.
 */
export const HN_TERMS = ["AI", "LLM", "LLMs", "GPT", "ChatGPT", "OpenAI", "Anthropic", "Claude", "Gemini", "Copilot", "DeepSeek", "Llama", "Mistral"];
/** A story enters the dataset once it clears this many points. */
export const MIN_POINTS = 50;
/**
 * Each run re-reads every qualifying story from the last few days. New stories
 * enter the dataset, and stories already in it get their latest points, so a
 * story caught at 60 points that later reaches 400 still counts as heat.
 */
export const RESCORE_DAYS = 3;

interface HnHit {
  title?: string;
  url?: string;
  created_at?: string;
  points?: number;
}

function toItem(h: HnHit & { title: string; url: string }): RawItem {
  return { title: h.title, url: h.url, source: "hackernews", publishedAt: h.created_at, score: h.points };
}

/**
 * Every story matching HN_TERMS with more than MIN_POINTS created in [from, to), in seconds
 * since epoch. The live crawl and the historical backfill both use this, so
 * the two halves of the dataset are collected the same way.
 */
export async function fetchHnRange(from: number, to: number): Promise<RawItem[]> {
  const items: RawItem[] = [];
  // Algolia returns at most 1000 hits per query, so walk the range in slices
  // small enough to stay under that. A day holds a few dozen stories.
  const SLICE = 7 * 86_400;
  for (let start = from; start < to; start += SLICE) {
    const end = Math.min(start + SLICE, to);
    for (let page = 0; ; page++) {
      const filters = `points>${MIN_POINTS},created_at_i>=${start},created_at_i<${end}`;
      // optionalWords turns the terms into an OR. prefixNone stops "AI" from
      // matching as a prefix of "air", "airport" and "aircraft".
      const words = encodeURIComponent(HN_TERMS.join(" "));
      const url = `${ENDPOINT}?query=${words}&optionalWords=${words}&queryType=prefixNone&tags=story&numericFilters=${filters}&hitsPerPage=1000&page=${page}`;
      const res = await politeFetch(url);
      if (!res.ok) throw new Error(`HN ${res.status}`);
      const data = (await res.json()) as { hits?: HnHit[]; nbPages?: number };
      for (const h of data.hits ?? []) {
        if (h.title && h.url) items.push(toItem(h as HnHit & { title: string; url: string }));
      }
      if (page + 1 >= (data.nbPages ?? 1)) break;
    }
  }
  return items;
}

/** AI stories from Hacker News that the community pushed past MIN_POINTS. */
export const hackerNews: Source = {
  name: "hackernews",
  async fetch(): Promise<RawItem[]> {
    const now = Math.floor(Date.now() / 1000);
    return fetchHnRange(now - RESCORE_DAYS * 86_400, now + 60);
  },
};

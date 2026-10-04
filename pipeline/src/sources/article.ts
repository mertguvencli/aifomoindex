import { politeText } from "../polite.js";
import type { RawItem } from "../types.js";

export function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A quoted attribute value runs to its own closing quote, so an apostrophe
 * inside double quotes ("How we're …") stays part of the value.
 */
const VALUE = `(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`;

/** The content of the first <meta> tag whose property or name is `prop`, in either attribute order. */
export function meta(html: string, prop: string): string | undefined {
  // Quoted attribute values may themselves contain ">".
  for (const tag of html.match(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) ?? []) {
    const key = tag.match(new RegExp(`\\b(?:property|name)\\s*=\\s*${VALUE}`, "i"));
    if ((key?.[1] ?? key?.[2] ?? key?.[3])?.toLowerCase() !== prop.toLowerCase()) continue;
    const content = tag.match(new RegExp(`\\bcontent\\s*=\\s*${VALUE}`, "i"));
    const v = content?.[1] ?? content?.[2] ?? content?.[3];
    return v ? decode(v) : undefined;
  }
  return undefined;
}

const DAY = 86_400_000;

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const SHORT = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";

/**
 * Publish date, most trustworthy first. JSON-LD `datePublished` wins because
 * some sites (DeepMind) put the last-modified time in `article:published_time`.
 * Docs-style news pages (DeepSeek) carry the date only in the page's own nav
 * entry, e.g. "V4.1-Flash Release 2026/09/10"; that beats dates in the body.
 * Then the first written-out date on the page, and last a microdata
 * `itemprop="datePublished"`.
 */
export function publishDate(html: string): string | undefined {
  const nav = html.match(/aria-current=["']page["'][^>]*>[^<]*?\b(20\d\d)[/-](\d{2})[/-](\d{2})\b/);
  const candidates = [
    html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1],
    meta(html, "article:published_time"),
    nav && `${nav[1]}-${nav[2]}-${nav[3]}`,
    html.match(new RegExp(`\\b(?:${MONTHS}) \\d{1,2}, 20\\d\\d\\b`))?.[0],
    html.match(new RegExp(`\\b(?:${SHORT}) \\d{1,2}, 20\\d\\d\\b`))?.[0],
    // Microdata only (World Labs), where nothing above is on the page.
    html.match(/itemprop=["']datePublished["'][^>]*?content=["']([^"']+)["']/i)?.[1],
  ];
  for (const c of candidates) {
    if (!c) continue;
    const t = Date.parse(c);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return undefined;
}

/**
 * Title without the " | Site" or " \ Site" suffix most pages append. Some sites
 * put the name first instead ("Runway Research | Introducing Gen-4.5"), so when
 * a part of the title holds the page's <h1>, that part is the title.
 */
export function pageTitle(html: string): string | undefined {
  const og = meta(html, "og:title");
  const tag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const raw = og ?? (tag ? decode(tag) : undefined);
  if (!raw) return undefined;
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const heading = h1 ? decode(h1.replace(/<[^>]+>/g, " ")).toLowerCase() : "";
  const parts = raw.split(/\s+[|\\]\s+/);
  if (heading && parts.length > 1) {
    const part = parts.find((p) => p.toLowerCase().includes(heading));
    if (part) return part.trim();
  }
  return raw.replace(/\s+[|\\–—-]\s+[^|\\–—-]{2,40}$/, "").trim() || undefined;
}

/** Fetch one article page and read its title, publish date and description. */
export async function fetchArticle(url: string, source: string): Promise<RawItem | undefined> {
  const html = await politeText(url);
  const title = pageTitle(html);
  const publishedAt = publishDate(html);
  // Without a date the item would be stamped "now" and fake a spike, so skip it.
  if (!title || !publishedAt) return undefined;
  // A date still ahead is an event or template date (Runway's category pages), not when it was posted.
  if (Date.parse(publishedAt) > Date.now() + DAY) return undefined;
  return { title, url, source, publishedAt, rawContent: meta(html, "og:description") ?? meta(html, "description") };
}

/** Run `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

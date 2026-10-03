import { canonicalUrl } from "../hash.js";
import type { CrawlContext, RawItem, Source } from "../types.js";
import { politeText } from "../polite.js";
import { fetchArticle, mapLimit } from "./article.js";

export interface PageConfig {
  name: string;
  /** The lab's news index, e.g. https://www.anthropic.com/news */
  url: string;
  /** Article links on that page start with this path, e.g. "/news/". */
  articlePath: string;
}

/**
 * Most new article links per run. A list page shows the newest posts first,
 * and runs are six hours apart, so a dozen leaves plenty of headroom.
 */
const MAX_NEW_PER_RUN = 12;

/** Every article link on a list page, in page order, as absolute canonical URLs. */
export function articleLinks(html: string, pageUrl: string, articlePath: string): string[] {
  const base = new URL(pageUrl);
  const seen = new Set<string>();
  const links: string[] = [];
  for (const m of html.matchAll(/href=["']?([^"'\s>]+)/gi)) {
    let u: URL;
    try {
      u = new URL(m[1]!, base);
    } catch {
      continue;
    }
    if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    const path = u.pathname.replace(/\/$/, "");
    // An article, not the index itself or a category page under it.
    if (!path.startsWith(articlePath) || path.length <= articlePath.length) continue;
    if (path.slice(articlePath.length).includes("/")) continue;
    u.search = "";
    u.hash = "";
    const key = canonicalUrl(u.toString());
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(u.toString());
  }
  return links;
}

/**
 * For labs without an RSS feed (Anthropic, Mistral, Meta): read the news index,
 * then fetch only the article pages not yet in the dataset to get their dates.
 */
export function pageSource(cfg: PageConfig): Source {
  return {
    name: cfg.name,
    async fetch(ctx: CrawlContext): Promise<RawItem[]> {
      const links = articleLinks(await politeText(cfg.url), cfg.url, cfg.articlePath);
      if (links.length === 0) throw new Error(`${cfg.name}: no article links found, the page layout may have changed`);
      const fresh = links.filter((u) => !ctx.known(u)).slice(0, MAX_NEW_PER_RUN);
      const items = await mapLimit(fresh, 3, (u) => fetchArticle(u, cfg.name).catch(() => undefined));
      return items.filter((it): it is RawItem => Boolean(it));
    },
  };
}

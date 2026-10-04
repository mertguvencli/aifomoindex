/** One raw item as pulled from a source, before refinement. */
export interface RawItem {
  title: string;
  url: string;
  source: string;
  /** ISO 8601. May be missing from some sources; defaulted at finalize time. */
  publishedAt?: string;
  /** Source-provided excerpt/description, used as context for refinement. */
  rawContent?: string;
  /** Hacker News points at crawl time. Stored as `points` so the index can re-score it later. */
  score?: number;
}

/** What a source can ask about the dataset while crawling. */
export interface CrawlContext {
  /** True when this URL is already in the dataset, so a source can skip fetching its page. */
  known(url: string): boolean;
}

/** The value the Refinement stage adds to a raw item. */
export interface Refinement {
  /** Always the story's own title. The pipeline never writes its own descriptions. */
  summary: string;
  tags: string[];
  /** 1 (minor) .. 5 (field-shifting). */
  importance: number;
}

/** A fully processed item, ready to be written to the dataset. */
export interface NewsItem extends RawItem, Refinement {
  id: string;
  fetchedAt: string;
  publishedAt: string;
}

/** A pluggable source. Adding a source = exporting one of these. */
export interface Source {
  name: string;
  fetch(ctx: CrawlContext): Promise<RawItem[]>;
}

/** A row in data/index.json — the machine-readable view of the dataset. */
export interface IndexEntry {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  tags: string[];
  importance: number;
  summary: string;
  /** Hacker News points for this URL, refreshed while the story is young. Absent if it never made HN. */
  points?: number;
  /** Path to the markdown file, relative to data/. */
  path: string;
}

/** Controlled tag vocabulary. Keep small and stable so the dataset stays queryable. */
export const TAG_VOCAB = [
  "model",
  "tool",
  "research",
  "funding",
  "policy",
  "opensource",
  "infra",
  "product",
  "safety",
] as const;

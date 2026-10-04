export function annotateFresh(options: {
  items: Array<{ id: string; title: string; publishedAt: string; rawContent?: string; fetch?: string }>;
  directory: string;
  apiKey: string | undefined;
  concurrency?: number;
  mode?: "crawl" | "backfill";
}): Promise<{ annotated: number; failed: number; skipped?: number }>;

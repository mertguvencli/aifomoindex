import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Source } from "../types.js";
import { hackerNews } from "./hackernews.js";
import { pageSource, type PageConfig } from "./page.js";
import { rssSource } from "./rss.js";

const here = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(here, "..", "..", "sources.config.json");

export interface SourcesConfig {
  feeds?: Array<{ name: string; url: string }>;
  pages?: PageConfig[];
  blockedHosts?: string[];
}

export async function loadConfig(): Promise<SourcesConfig> {
  return JSON.parse(await readFile(CONFIG_PATH, "utf8")) as SourcesConfig;
}

/**
 * Every RSS feed and news page in sources.config.json, then Hacker News. Order
 * matters: when a lab post is also on Hacker News, the lab gets the story.
 */
export async function loadSources(): Promise<Source[]> {
  const cfg = await loadConfig();
  const feeds = (cfg.feeds ?? []).map((f) => rssSource(f.name, f.url));
  const pages = (cfg.pages ?? []).map(pageSource);
  return [...feeds, ...pages, hackerNews];
}

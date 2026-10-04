import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Repo-root `data/` directory — the dataset itself. */
export const DATA_DIR = join(here, "..", "..", "data");
export const NEWS_DIR = join(DATA_DIR, "news");
export const INDEX_PATH = join(DATA_DIR, "index.json");
export const SEEN_PATH = join(DATA_DIR, "seen.json");

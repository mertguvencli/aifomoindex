import { HEAT_POINTS } from "./finalize.js";
import { keywordTags } from "./tags.js";
import type { RawItem, Refinement } from "./types.js";

/**
 * Stage 3 — Refinement. Keyword tags and a points-based importance, no model
 * call: semantic judgments live in the Jev annotations (see run.ts), which
 * carry zero index weight. It deliberately writes no summary: the dataset only
 * ever states a story's own headline, so it can't misquote anyone.
 */
export function refine(item: RawItem): Refinement {
  return {
    summary: item.title,
    tags: keywordTags(item.title, item.source),
    importance: (item.score ?? 0) >= HEAT_POINTS ? 3 : 2,
  };
}

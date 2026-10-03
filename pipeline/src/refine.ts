import { HEAT_POINTS } from "./finalize.js";
import { keywordTags } from "./tags.js";
import { TAG_VOCAB, type RawItem, type Refinement } from "./types.js";

const MODEL = "claude-haiku-4-5-20251001";

function clampImportance(value: unknown, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, n));
}

/** No API key (e.g. a fork or PR run) → keep the item, tag it by keywords, don't summarize. */
export function fallback(item: RawItem): Refinement {
  return {
    summary: item.title,
    tags: keywordTags(item.title, item.source),
    importance: (item.score ?? 0) >= HEAT_POINTS ? 3 : 2,
  };
}

function prompt(item: RawItem): string {
  return [
    "You are the refinement step of an open-source AI-news pipeline.",
    "Return STRICT JSON only, no prose, in this exact shape:",
    '{"tags": string[], "importance": number}',
    `- tags: subset of [${TAG_VOCAB.join(", ")}].`,
    "- importance: integer 1-5 (5 = field-shifting, 1 = minor).",
    "",
    `Title: ${item.title}`,
    `URL: ${item.url}`,
    `Excerpt: ${(item.rawContent ?? "").slice(0, 1000)}`,
  ].join("\n");
}

/**
 * Stage 3 — Refinement. Tag and score one item with a small, cheap model.
 * It deliberately writes no summary: the dataset only ever states a story's
 * own headline, so it can't misquote or misdescribe anyone. Degrades gracefully to a fallback when ANTHROPIC_API_KEY is absent or
 * the call fails, so the pipeline always produces a valid dataset.
 */
export async function refine(item: RawItem): Promise<Refinement> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback(item);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 100,
        messages: [{ role: "user", content: prompt(item) }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);

    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text ?? "";
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as Partial<Pick<Refinement, "tags" | "importance">>;
    const tags = Array.isArray(json.tags)
      ? json.tags.map(String).filter((t) => (TAG_VOCAB as readonly string[]).includes(t)).slice(0, 5)
      : [];
    return {
      summary: item.title,
      tags,
      // 200+ points count as heat whatever the model says, as in rescore().
      importance: Math.max(clampImportance(json.importance, 2), (item.score ?? 0) >= HEAT_POINTS ? 3 : 1),
    };
  } catch (err) {
    console.warn(`  ! refine fallback for ${item.url}: ${err}`);
    return fallback(item);
  }
}

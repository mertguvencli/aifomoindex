import { TAG_VOCAB } from "./types.js";

type Tag = (typeof TAG_VOCAB)[number];

/**
 * Keyword tagging for when there is no LLM refinement (no API key, or the call
 * failed). Broad on purpose: a dataset row with a rough tag is more useful
 * than one with none. Title-only, so it gives the same answer every run.
 */
const RULES: Array<[Tag, RegExp]> = [
  ["model", /\b(gpt[- ]?\d[\w.]*|o\d\b|claude|gemini|gemma|llama|mistral|qwen\w*|deepseek|grok|kimi|glm[- ]?\d[\w.]*|llms?|models?|reasoning|benchmarks?|multimodal)\b/i],
  ["tool", /\b(tools?|agents?|agentic|mcp|copilot|cursor|codex|sdk|api|cli|plugins?|extensions?|ide)\b/i],
  ["research", /\b(paper|research\w*|arxiv|study|studies|interpretab\w*|training|dataset|scaling|neural|science|scientists?|protein|genom\w*|alpha\w+)\b/i],
  ["funding", /\b(funding|raises?|raised|raising|valuation|acquir\w*|acquisition|ipo|investment|invests?|series [a-f]|\$\d[\d.,]*\s?(m|b|bn|million|billion))\b/i],
  ["policy", /\b(regulat\w*|laws?|policy|policies|govern\w*|congress|senate|eu|court|lawsuits?|sues?|sued|copyright|ban(s|ned)?|white house|executive order)\b/i],
  ["opensource", /\b(open[- ]?source|open[- ]?weights?|hugging ?face|self[- ]hosted|local(ly)?|show hn)\b/i],
  ["infra", /\b(gpus?|nvidia|chips?|tpus?|data ?cent(er|re)s?|compute|inference|clusters?|semiconductor\w*|power|energy|serving)\b/i],
  ["product", /\b(launch\w*|introduc\w*|available|roll(ing)? out|releases?|released|now in|new features?|apps?|chatgpt)\b/i],
  ["safety", /\b(safety|safe|alignment|misuse|jailbreak\w*|red[- ]team\w*|risks?|harm\w*|security|deepfakes?|watermark\w*)\b/i],
];

export function keywordTags(title: string, source: string): string[] {
  const tags = RULES.filter(([, re]) => re.test(title)).map(([tag]) => tag as string);
  if (source === "huggingface" && !tags.includes("opensource")) tags.push("opensource");
  return tags.slice(0, 5);
}

/**
 * Title-based classification. The pipeline's `tags` are mostly empty, so the
 * site derives topics and companies from titles at build time. Keyword lists
 * are deliberately broad — a false positive costs less than a missing filter.
 */

export interface Topic {
  id: string;
  label: string;
  pattern: RegExp;
}

export const TOPICS: Topic[] = [
  {
    id: "models",
    label: "Models",
    pattern:
      /\b(gpt[- ]?\d[\w.]*|o\d\b|claude|gemini|gemma|llama|mistral|qwen\w*|deepseek|grok|kimi|glm[- ]?\d[\w.]*|llms?|models?|reasoning|benchmarks?|frontier|multimodal|tokens?)\b/i,
  },
  {
    id: "agents",
    label: "Agents",
    pattern: /\b(agents?|agentic|mcp|computer use|tool use|autonomous|assistants?|codex|workflows?|automat\w*)\b/i,
  },
  {
    id: "coding",
    label: "Coding",
    pattern:
      /\b(cod(e|es|ing|er)|copilot|cursor|developers?|programming|programmers?|software|ide|vibe|github|engineer(s|ing)?|python|rust|javascript|typescript|cobol|java|refactor\w*|swe[- ]?\w*|terminal)\b/i,
  },
  {
    id: "research",
    label: "Research",
    pattern:
      /\b(paper|research\w*|arxiv|study|studies|interpretab\w*|training|dataset|scaling|learning|neural|math\w*|science|scientists?|genom\w*|protein|biology|alphafold|alpha\w+)\b/i,
  },
  {
    id: "policy",
    label: "Policy & Safety",
    pattern:
      /\b(safety|safe|alignment|regulat\w*|laws?|policy|policies|govern\w*|pentagon|military|copyright|lawsuits?|sues?|sued|ban(s|ned|ning)?|eu|europe\w*|congress|senate|ethic\w*|privacy|risks?|court|trump|white house|security|surveillance|jobs?|workforce|harm\w*|manipulat\w*|slop|doom\w*|defen[cs]\w*)\b/i,
  },
  {
    id: "business",
    label: "Business",
    pattern:
      /\b(ipo|funding|rais(e|es|ed|ing)|acquir\w*|acquisition|valuation|billion|trillion|\$\d\w*|startups?|revenue|invest\w*|joins|joining|deal|layoffs?|stocks?|market|pric(e|es|ing)|econom\w*|bubble|ceo|premium|enterprise|business|buildout|industry)\b/i,
  },
  {
    id: "hardware",
    label: "Chips & Compute",
    pattern:
      /\b(gpus?|nvidia|amd|chips?|tpus?|data ?cent(er|re)s?|compute|semiconductor\w*|tsmc|hardware|power|energy|intel|supercomput\w*|cluster)\b/i,
  },
  {
    id: "opensource",
    label: "Open Source",
    pattern: /\b(open[- ]?source|open[- ]?weights?|oss|hugging ?face|local(ly)?|self[- ]hosted|show hn)\b/i,
  },
  {
    id: "media",
    label: "Image, Video & Audio",
    pattern:
      /\b(images?|video|music|audio|voice|speech|lyria|veo|sora|imagen|nano banana|diffusion|3d|art|artists?|creative|film|design|sign language|games?|gaming|midjourney|dall[- ]?e|flux[.\s-]?\d[\w.]*|flux kontext|stable (audio|video|cascade)|sdxl|gen[- ][1-4](\.5)?|kling|seedance|seedream|hailuo|firefly|ideogram|suno|udio|eleven ?labs|text[- ]to[- ](speech|image|video|music)|tts|avatars?|gaussian splat\w*|3dgs)\b/i,
  },
  {
    id: "products",
    label: "Products",
    pattern:
      /\b(chatgpt|search|apps?|features?|introduc\w*|launch\w*|available|roll(ing)? out|rollout|update[sd]?|now in|coming to|new ways|ways to|tips|shopping|android|chrome|workspace|gmail|pixel)\b/i,
  },
  {
    id: "robotics",
    label: "Robotics",
    pattern:
      /\b(robot(s|ic|ics)?|humanoids?|self[- ]driving|waymo|tesla|vehicles?|drones?|embodied|robotaxis?|autonomous driving|optimus|unitree|boston dynamics|physical ai|world action models?|vla)\b/i,
  },
];

export interface Entity {
  id: string;
  label: string;
  pattern: RegExp;
  /** Items from these sources always count as mentioning the entity. */
  sources?: string[];
}

export const ENTITIES: Entity[] = [
  {
    id: "openai",
    label: "OpenAI",
    pattern: /\b(openai|chatgpt|gpt[- ]?\d[\w.]*|gpt[- ]image[\w.-]*|dall[- ]?e[\w.-]*|sora|codex|altman)\b/i,
    sources: ["openai"],
  },
  { id: "anthropic", label: "Anthropic", pattern: /\b(anthropic|claude)\b/i, sources: ["anthropic"] },
  {
    id: "google",
    label: "Google",
    pattern: /\b(google|gemini|gemma|deepmind|alpha\w+|veo|lyria|imagen|waymo)\b/i,
    sources: ["googleai", "deepmind"],
  },
  { id: "meta", label: "Meta", pattern: /\b(meta|llama|zuckerberg)\b/i },
  { id: "nvidia", label: "Nvidia", pattern: /\bnvidia\b/i },
  { id: "microsoft", label: "Microsoft", pattern: /\b(microsoft|copilot|azure|nadella)\b/i },
  { id: "apple", label: "Apple", pattern: /\b(apple|iphone|siri)\b/i },
  { id: "xai", label: "xAI", pattern: /\b(xai|grok|musk)\b/i, sources: ["xai"] },
  { id: "huggingface", label: "Hugging Face", pattern: /\bhugging ?face\b/i, sources: ["huggingface"] },
  { id: "deepseek", label: "DeepSeek", pattern: /\bdeepseek\b/i, sources: ["deepseek"] },
  { id: "alibaba", label: "Alibaba (Qwen)", pattern: /\b(alibaba|qwen\w*)\b/i, sources: ["qwen"] },
  { id: "zhipu", label: "Zhipu (GLM)", pattern: /\b(zhipu|z\.ai|glm[- ]?\d[\w.]*)\b/i, sources: ["zhipu"] },
  { id: "moonshot", label: "Moonshot (Kimi)", pattern: /\b(moonshot ai|kimi)\b/i, sources: ["moonshot"] },
  { id: "mistral", label: "Mistral", pattern: /\bmistral\b/i, sources: ["mistral"] },
  { id: "amazon", label: "Amazon", pattern: /\b(amazon|aws|bezos)\b/i },
  { id: "tesla", label: "Tesla", pattern: /\b(tesla|optimus)\b/i },
  { id: "bytedance", label: "ByteDance", pattern: /\b(bytedance|seedance|seedream|doubao|tiktok)\b/i },
  { id: "kuaishou", label: "Kuaishou (Kling)", pattern: /\b(kuaishou|kling)\b/i, sources: ["kling"] },
  { id: "minimax", label: "MiniMax", pattern: /\b(minimax|hailuo)\b/i, sources: ["minimax"] },
  { id: "adobe", label: "Adobe", pattern: /\b(adobe|firefly|photoshop)\b/i },
  {
    id: "stability",
    label: "Stability AI",
    pattern: /\b(stability ai|stable diffusion|sdxl|stable (audio|video|cascade|lm))\b/i,
    sources: ["stability"],
  },
  { id: "midjourney", label: "Midjourney", pattern: /\bmidjourney\b/i, sources: ["midjourney"] },
  {
    id: "runway",
    label: "Runway",
    pattern: /\b(runwayml|runway (ai|ml|research|gen[- ]?\d[\w.]*|aleph|act[- ]?\w+|gwm[\w-]*))\b/i,
    sources: ["runway"],
  },
  {
    id: "bfl",
    label: "Black Forest Labs",
    pattern: /\b(black forest labs|flux[.\s-]?\d[\w.]*|flux kontext)\b/i,
    sources: ["bfl"],
  },
  { id: "luma", label: "Luma AI", pattern: /\b(luma (ai|labs)|dream machine)\b/i, sources: ["luma"] },
  { id: "pika", label: "Pika", pattern: /\b(pika (labs|art|\d[\w.]*))\b/i, sources: ["pika"] },
  { id: "suno", label: "Suno", pattern: /\bsuno\b/i, sources: ["suno"] },
  { id: "elevenlabs", label: "ElevenLabs", pattern: /\beleven ?labs\b/i, sources: ["elevenlabs"] },
  { id: "worldlabs", label: "World Labs", pattern: /\b(world labs|fei-fei li)\b/i, sources: ["worldlabs"] },
  { id: "figure", label: "Figure AI", pattern: /\b(figure ai|figure 0\d)\b/i, sources: ["figure"] },
  { id: "wayve", label: "Wayve", pattern: /\bwayve\b/i, sources: ["wayve"] },
  { id: "bostondynamics", label: "Boston Dynamics", pattern: /\bboston dynamics\b/i, sources: ["bostondynamics"] },
  { id: "agility", label: "Agility Robotics", pattern: /\bagility robotics\b/i, sources: ["agility"] },
  {
    id: "physicalintelligence",
    label: "Physical Intelligence",
    pattern: /\bphysical intelligence\b/i,
    sources: ["physicalintelligence"],
  },
];

/**
 * Labs whose own posts mostly reach the dataset through Hacker News, because
 * their news pages can't be crawled (x.ai sits behind Cloudflare, the others
 * render in JavaScript) or are mostly SEO guides we don't count as news. Crawled
 * labs are listed too, for the pages the crawl skips (Runway's /news). A link to
 * one of these hosts, or a subdomain, is the lab's own post, so the feed files
 * it under the lab like a crawled one.
 */
export const LAB_HOSTS: Record<string, string[]> = {
  xai: ["x.ai"],
  deepseek: ["deepseek.com"],
  qwen: ["qwen.ai", "qwenlm.github.io"],
  zhipu: ["z.ai", "bigmodel.cn", "zhipuai.cn"],
  moonshot: ["kimi.com", "moonshot.ai", "moonshot.cn", "moonshotai.github.io"],
  stability: ["stability.ai"],
  midjourney: ["midjourney.com"],
  runway: ["runway.com", "runwayml.com"],
  bfl: ["bfl.ai", "blackforestlabs.ai"],
  luma: ["lumalabs.ai"],
  pika: ["pika.art"],
  suno: ["suno.com", "suno.ai"],
  elevenlabs: ["elevenlabs.io"],
  kling: ["klingai.com"],
  minimax: ["minimax.io", "minimaxi.com", "hailuoai.video"],
  ideogram: ["ideogram.ai"],
  krea: ["krea.ai"],
  synthesia: ["synthesia.io"],
  heygen: ["heygen.com"],
  hedra: ["hedra.com"],
  cartesia: ["cartesia.ai"],
  udio: ["udio.com"],
  worldlabs: ["worldlabs.ai"],
  decart: ["decart.ai"],
  figure: ["figure.ai"],
  wayve: ["wayve.ai"],
  bostondynamics: ["bostondynamics.com"],
  agility: ["agilityrobotics.com"],
  physicalintelligence: ["physicalintelligence.company", "pi.website"],
  onex: ["1x.tech"],
  skild: ["skild.ai"],
};

const AGGREGATORS = new Set(["hackernews", "seed"]);

/** Who published the story: the lab for a lab-host link found via an aggregator, else the source. */
export function publisherOf(source: string, domain: string): string {
  if (!AGGREGATORS.has(source)) return source;
  for (const [lab, hosts] of Object.entries(LAB_HOSTS)) {
    if (hosts.some((h) => domain === h || domain.endsWith(`.${h}`))) return lab;
  }
  return source;
}

export function classifyTopics(title: string, source: string): string[] {
  const ids = TOPICS.filter((t) => t.pattern.test(title)).map((t) => t.id);
  if (source === "huggingface" && !ids.includes("opensource")) ids.push("opensource");
  return ids;
}

export function classifyEntities(title: string, source: string): string[] {
  return ENTITIES.filter((e) => e.sources?.includes(source) || e.pattern.test(title)).map((e) => e.id);
}

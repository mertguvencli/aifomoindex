/**
 * Hand-picked moments marked on the long-run chart, so a reader can line the
 * curve up with what happened. Editorial, not computed: chosen for what they
 * changed in the field, whether or not the curve moved with them.
 */
export interface Milestone {
  /** Stable key; the dataset item's id when the story is in the dataset. */
  id: string;
  /** Short name drawn on the chart. */
  label: string;
  title: string;
  /** One sentence on what changed. */
  why: string;
  /** When it happened, epoch ms; the start of a period. */
  at: number;
  /** The end of a period, for shifts that took months rather than a day. */
  end?: number;
  /** Publisher, for the logo and label. */
  source?: string;
  url?: string;
  /** Gets its name on the chart first when labels compete for room. */
  major?: boolean;
  /**
   * Optional cover image, a path under /public. Only images we may republish;
   * without one the card draws its own cover from the logo and title.
   */
  image?: string;
}

const day = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

export const MILESTONES: Milestone[] = [
  {
    id: "bc1a61aec959",
    label: "ChatGPT",
    title: "Introducing ChatGPT",
    why: "Turned LLMs from a research demo into a mass-market product, and made natural language the main interface to AI.",
    at: day(2022, 11, 30),
    source: "openai",
    url: "https://openai.com/index/chatgpt/",
    major: true,
  },
  {
    id: "97ef93e629bf",
    label: "GPT-4",
    title: "GPT-4",
    why: "Showed LLMs could handle serious reasoning, coding and professional work, not just text completion, and moved to multimodal input.",
    at: day(2023, 3, 14),
    source: "openai",
    url: "https://openai.com/index/gpt-4-research/",
    major: true,
  },
  {
    id: "66614eca74fd",
    label: "Long context",
    title: "100K context windows and function calling",
    why: "Claude could read hundreds of pages at once, and function calling let models call outside APIs in a controlled way: early foundations of today's agents.",
    at: day(2023, 5, 11),
    end: day(2023, 6, 13),
    source: "anthropic",
    url: "https://www.anthropic.com/news/100k-context-windows",
  },
  {
    id: "a3f2fd44a19b",
    label: "Llama 2",
    title: "Llama 2 and open models",
    why: "Broke the idea that strong LLMs would only come through a few companies' closed APIs; self-hosted and fine-tuned models became a real ecosystem.",
    at: day(2023, 7, 18),
    source: "Meta",
    url: "https://about.fb.com/news/2023/07/llama-2/",
    major: true,
  },
  {
    id: "rag",
    label: "RAG boom",
    title: "Retrieval-augmented generation goes mainstream",
    why: "Companies stopped relying on what the model knew and wired their own data in through vector search and retrieval, now a standard part of enterprise AI.",
    at: day(2023, 10, 1),
    end: day(2024, 12, 31),
  },
  {
    id: "6f1916bf2587",
    label: "Gemini 1.5",
    title: "Gemini 1.5 and the 1M-token context",
    why: "Context windows jumped to a million tokens: whole codebases, hours of video and hundreds of thousands of words in one prompt.",
    at: day(2024, 2, 15),
    source: "googleai",
    url: "https://blog.google/innovation-and-ai/products/google-gemini-next-generation-model-february-2024/",
  },
  {
    id: "954c8d1d6efc",
    label: "AlphaFold 3",
    title: "AlphaFold 3",
    why: "One of the clearest signs that the generative-AI race was reaching past chatbots into scientific discovery.",
    at: day(2024, 5, 8),
    source: "deepmind",
    url: "https://blog.google/technology/ai/google-deepmind-isomorphic-alphafold-3-ai-model/",
  },
  {
    id: "2d3a533e91db",
    label: "GPT-4o",
    title: "GPT-4o and native multimodality",
    why: "Instead of a speech-to-text → LLM → text-to-speech pipeline, one model handled voice, vision and text in real time.",
    at: day(2024, 5, 13),
    source: "openai",
    url: "https://openai.com/index/hello-gpt-4o/",
    major: true,
  },
  {
    id: "d1359f03b307",
    label: "o1",
    title: "OpenAI o1 and test-time reasoning",
    why: "A new axis beyond bigger pretraining: let the model compute longer before it answers. The reasoning-model era began.",
    at: day(2024, 9, 12),
    source: "openai",
    url: "https://openai.com/index/learning-to-reason-with-llms/",
    major: true,
  },
  {
    id: "ad0bd0b1b154",
    label: "MCP",
    title: "Model Context Protocol",
    why: "A shared protocol for connecting tools and data sources to AI systems, since a core standard of the agent ecosystem.",
    at: day(2024, 11, 25),
    source: "anthropic",
    url: "https://www.anthropic.com/news/model-context-protocol",
  },
  {
    id: "afad87e802e5",
    label: "DeepSeek-R1",
    title: "DeepSeek-R1",
    why: "Showed reinforcement learning can strongly build reasoning, and that it can be done in open models.",
    at: day(2025, 1, 20),
    source: "deepseek",
    url: "https://arxiv.org/abs/2501.12948",
    major: true,
  },
  {
    id: "f0584842138a",
    label: "Operator",
    title: "Computer use and Operator",
    why: "Beyond calling APIs, AI started looking at the screen and using a mouse and keyboard to act in web apps.",
    at: day(2025, 1, 23),
    source: "openai",
    url: "https://openai.com/index/introducing-operator/",
  },
  {
    id: "coding-agents",
    label: "Coding agents",
    title: "Coding agents",
    why: "With Claude Code and similar tools, AI went from autocomplete to an engineering agent that works in a repository, runs tests and fixes bugs.",
    at: day(2025, 2, 24),
    end: day(2025, 5, 31),
    source: "anthropic",
    url: "https://www.anthropic.com/news/claude-3-7-sonnet",
  },
  {
    id: "gemini-2-5",
    label: "Gemini 2.5",
    title: "Reasoning goes mainstream",
    why: "Models like Gemini 2.5 began to build reasoning in as a core part of the model rather than a separate mode.",
    at: day(2025, 3, 25),
    source: "googleai",
    url: "https://blog.google/innovation-and-ai/models-and-research/google-deepmind/gemini-model-thinking-updates-march-2025/",
  },
  {
    id: "b074ccdb2d9e",
    label: "ChatGPT Agent",
    title: "ChatGPT agent",
    why: "Browsing, research, code execution and tool use merged under one agent: the model moved from researching to acting.",
    at: day(2025, 7, 17),
    source: "openai",
    url: "https://openai.com/index/introducing-chatgpt-agent/",
  },
  {
    id: "05738f6c55b7",
    label: "GPT-5",
    title: "GPT-5 and unified reasoning",
    why: "One system that decides on its own between a quick answer and longer reasoning.",
    at: day(2025, 8, 7),
    source: "openai",
    url: "https://openai.com/index/introducing-gpt-5/",
    major: true,
  },
  {
    id: "long-running-agents",
    label: "Long-running agents",
    title: "Long-running agents",
    why: "Agents went from a few tool calls to working much longer, using sub-agents and carrying complex tasks through.",
    at: day(2025, 9, 1),
    end: day(2026, 9, 30),
    source: "anthropic",
    url: "https://www.anthropic.com/claude/opus",
  },
  {
    id: "2015b07b78a1",
    label: "AI → Work",
    title: "AI becomes a work platform",
    why: "With products like ChatGPT Work the goal is no longer an answer but finished output, made by working across apps, files and the web.",
    at: day(2026, 7, 9),
    source: "openai",
    url: "https://openai.com/index/chatgpt-for-your-most-ambitious-work/",
  },
  {
    id: "long-horizon-autonomy",
    label: "Long-horizon autonomy",
    title: "The new frontier: long-horizon autonomy",
    why: "The common thread in frontier models is no longer benchmark smarts alone but computer use, coding, long agentic work and tool orchestration.",
    at: day(2026, 9, 1),
    source: "openai",
    url: "https://help.openai.com/en/articles/6825453-chatgpt-release-notes",
  },
];

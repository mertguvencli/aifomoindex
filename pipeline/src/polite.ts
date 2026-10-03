/**
 * Every outbound request goes through here, so crawling stays polite by
 * construction, wherever it runs (locally or on GitHub Actions):
 *
 * - One honest user agent with a link back to the repo. No browser disguise.
 * - robots.txt is read once per host and obeyed. A disallowed URL is never fetched.
 * - At most one request per host at a time, spaced MIN_GAP_MS apart
 *   (longer if the site's robots.txt asks for a Crawl-delay).
 * - A 403 or 429 is an answer, not an obstacle: the host is skipped for the
 *   rest of the run and nothing retries.
 */

export const BOT_NAME = "aifomoindex-bot";
export const UA = `${BOT_NAME}/0.3 (+https://github.com/mertguvencli/aifomoindex)`;
const MIN_GAP_MS = 1_000;
const MAX_GAP_MS = 30_000;
const TIMEOUT_MS = 20_000;

interface Rule {
  allow: boolean;
  pattern: string;
}

interface Robots {
  rules: Rule[];
  delayMs: number;
}

const robotsCache = new Map<string, Promise<Robots>>();
const queue = new Map<string, Promise<void>>();
const lastAt = new Map<string, number>();
const refused = new Set<string>();

/** The group for our bot if there is one, else the `*` group. */
export function parseRobots(txt: string): Robots {
  const groups: Array<{ agents: string[]; rules: Rule[]; delay?: number }> = [];
  let current: (typeof groups)[number] | undefined;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      // An empty Disallow allows everything; skip it.
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
    } else if (key === "crawl-delay") {
      const s = Number(value);
      if (Number.isFinite(s)) current.delay = s * 1000;
    }
  }
  // Groups naming the same agent are combined (RFC 9309 §2.2.1). An empty
  // User-agent line names no one, so it never matches.
  const mine = groups.filter((g) => g.agents.some((a) => a && a !== "*" && BOT_NAME.startsWith(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  const delays = chosen.map((g) => g.delay).filter((d): d is number => d !== undefined);
  return {
    rules: chosen.flatMap((g) => g.rules),
    delayMs: Math.min(MAX_GAP_MS, Math.max(MIN_GAP_MS, ...delays)),
  };
}

function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Longest matching rule wins; on a tie, Allow wins (Google's reading of the spec). */
export function allowed(robots: Robots, pathAndQuery: string): boolean {
  let best: Rule | undefined;
  for (const r of robots.rules) {
    if (!toRegex(r.pattern).test(pathAndQuery)) continue;
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r;
  }
  return best?.allow ?? true;
}

async function loadRobots(origin: string): Promise<Robots> {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // No robots.txt means no restrictions. A server error means we can't
    // tell, so stay out, as the spec recommends.
    if (res.status >= 500) return { rules: [{ allow: false, pattern: "/" }], delayMs: MIN_GAP_MS };
    if (!res.ok) return { rules: [], delayMs: MIN_GAP_MS };
    return parseRobots(await res.text());
  } catch {
    return { rules: [{ allow: false, pattern: "/" }], delayMs: MIN_GAP_MS };
  }
}

function robotsFor(origin: string): Promise<Robots> {
  let p = robotsCache.get(origin);
  if (!p) robotsCache.set(origin, (p = loadRobots(origin)));
  return p;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAX_REDIRECTS = 5;

/**
 * Fetch `url` politely. Throws if robots.txt forbids it or the host refused us
 * this run. Redirects are followed by hand, so every hop gets the same checks
 * (a redirect to another host must not skip that host's robots.txt).
 */
export async function politeFetch(url: string, init: { accept?: string } = {}, hops = 0): Promise<Response> {
  const res = await fetchOnce(url, init);
  const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
  if (!location) return res;
  await res.body?.cancel();
  if (hops >= MAX_REDIRECTS) throw new Error(`too many redirects from ${url}`);
  return politeFetch(new URL(location, url).toString(), init, hops + 1);
}

async function fetchOnce(url: string, init: { accept?: string }): Promise<Response> {
  const u = new URL(url);
  const host = u.host;
  if (refused.has(host)) throw new Error(`${host} refused an earlier request this run; not retrying`);
  const robots = await robotsFor(u.origin);
  if (!allowed(robots, u.pathname + u.search)) throw new Error(`robots.txt disallows ${url}`);

  // Chain requests per host so they run one at a time, spaced out.
  const prev = queue.get(host) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  queue.set(host, prev.then(() => mine));
  await prev;
  try {
    const wait = (lastAt.get(host) ?? 0) + robots.delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    const res = await fetch(url, {
      headers: { "user-agent": UA, ...(init.accept && { accept: init.accept }) },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 403 || res.status === 429) refused.add(host);
    return res;
  } finally {
    lastAt.set(host, Date.now());
    release();
  }
}

/** politeFetch, then the body as text; throws on a non-2xx status. */
export async function politeText(url: string): Promise<string> {
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

import { createHash } from "node:crypto";

const TRACKING_PARAM = /^(utm_|ref$|source$|gclid$|fbclid$|mc_)/i;

/**
 * Normalize a URL so the same article from different links collapses to one id:
 * treat http as https, drop the fragment and tracking params, strip a leading
 * `www.`, lowercase the host, and remove a trailing slash. The path keeps its
 * case: on many servers /Foo and /foo are different pages.
 */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (u.protocol === "http:") u.protocol = "https:";
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
    }
    u.hostname = u.hostname.replace(/^www\./, "").toLowerCase();
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}

/** Stable 12-char id derived from the canonical URL. */
export function itemId(url: string): string {
  return createHash("sha256").update(canonicalUrl(url)).digest("hex").slice(0, 12);
}

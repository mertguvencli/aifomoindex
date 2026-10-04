/**
 * Canonical site URL. The deploy workflow sets it from the Pages settings, so
 * it is https://<user>.github.io/<repo> until a custom domain is attached.
 * Pages reports http:// when "Enforce HTTPS" is off (Cloudflare terminates TLS),
 * but the site is only ever served over HTTPS, so the scheme is forced.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://aifomoindex.com")
  .replace(/^http:\/\//, "https://")
  .replace(/\/$/, "");

/** GitHub repository. Renaming the repo? GitHub redirects the old URL, but update this too. */
export const REPO = "https://github.com/mertguvencli/aifomoindex";

/** Set for project pages served under /<repo>; empty at a domain root. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** The full feed the home page loads after hydration. Versioned so it never lags the page. */
export const feedJsonUrl = (updatedAt: number) => `${BASE_PATH}/feed.json?v=${updatedAt}`;

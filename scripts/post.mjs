#!/usr/bin/env node
/**
 * Posts the AI FOMO Index to X and Bluesky. Reads /fomo.json from the live
 * site, so it always posts what the site shows.
 *
 * It posts on Mondays (the weekly reading), and on any day the index first
 * enters High activity. Other days it exits quietly. Each network is skipped when
 * its credentials are missing, so forks stay quiet.
 *
 *   node --env-file=.env scripts/post.mjs --dry-run   # print the post, send nothing
 *   node --env-file=.env scripts/post.mjs --force     # post even if today isn't a posting day
 *   node --env-file=.env scripts/post.mjs --only=x    # one network (x or bluesky)
 *   --no-link          leave the site link out (e.g. before the site is live)
 *   FOMO_JSON=path     read the index from a local file instead of the site
 *
 * X:       X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET (OAuth 1.0a, read and write)
 * Bluesky: BLUESKY_HANDLE, BLUESKY_APP_PASSWORD
 */
import { createHmac, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

const SITE = process.env.SITE_URL ?? "https://aifomoindex.com";
const HIGH_ACTIVITY = 75;
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const withLink = !args.includes("--no-link");
const only = args.find((a) => a.startsWith("--only="))?.slice(7);

async function getJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}: ${await res.text()}`);
  return res.json();
}

async function loadIndex() {
  if (process.env.FOMO_JSON) return JSON.parse(await readFile(process.env.FOMO_JSON, "utf8"));
  return getJson(`${SITE}/fomo.json`);
}

/** Monday, or the first day of a High activity run. */
function reasonToPost(fomo, today = new Date()) {
  const h = fomo.history ?? [];
  const yesterday = h.length > 1 ? h[h.length - 2].score : undefined;
  if (fomo.score >= HIGH_ACTIVITY && yesterday !== undefined && yesterday < HIGH_ACTIVITY) return "alert";
  if (today.getUTCDay() === 1) return "weekly";
  return force ? "weekly" : undefined;
}

/** The post text. Short enough for X's 280 characters, where a link counts as 23. */
function compose(fomo, reason) {
  const delta =
    fomo.weekAgo == null ? "" : ` (${fomo.score >= fomo.weekAgo ? "▲" : "▼"}${Math.abs(fomo.score - fomo.weekAgo)} vs last week)`;
  const head =
    reason === "alert"
      ? `🚨 The AI FOMO Index just hit ${fomo.score}. High activity.`
      : `AI FOMO Index this week: ${fomo.score} · ${fomo.label}${delta}`;
  const driver = fomo.drivers?.[0]?.title;
  // The report link takes room, so the driver gets less when it's included.
  const max = withLink ? 50 : 90;
  const lines = [head, "", fomo.verdict];
  if (driver) lines.push("", `Example headline: ${driver.length > max ? `${driver.slice(0, max - 3)}…` : driver}`);
  const link = SITE.replace(/^https?:\/\//, "");
  const report = `${link}/report.pdf`;
  // The report line comes first so the bare site link stays the last match for its facet.
  if (withLink) lines.push("", `Weekly report: ${report}`, link);
  return { text: lines.join("\n"), link, report };
}

// ---------- X (OAuth 1.0a user context) ----------

const pct = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** OAuth 1.0a header. A JSON body is not part of the signature, so only the oauth_* params are signed. */
function oauthHeader(method, url, creds) {
  const params = {
    oauth_consumer_key: creds.key,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.token,
    oauth_version: "1.0",
  };
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${pct(k)}=${pct(params[k])}`)
    .join("&");
  const base = [method.toUpperCase(), pct(url), pct(paramString)].join("&");
  const signingKey = `${pct(creds.secret)}&${pct(creds.tokenSecret)}`;
  params.oauth_signature = createHmac("sha1", signingKey).update(base).digest("base64");
  return `OAuth ${Object.keys(params)
    .sort()
    .map((k) => `${pct(k)}="${pct(params[k])}"`)
    .join(", ")}`;
}

async function postToX(text) {
  const creds = {
    key: process.env.X_API_KEY,
    secret: process.env.X_API_SECRET,
    token: process.env.X_ACCESS_TOKEN,
    tokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
  };
  if (Object.values(creds).some((v) => !v)) return console.log("X: credentials not set, skipping.");
  const url = "https://api.x.com/2/tweets";
  const out = await getJson(url, {
    method: "POST",
    headers: { authorization: oauthHeader("POST", url, creds), "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  console.log(`X: posted https://x.com/i/web/status/${out.data.id}`);
}

// ---------- Bluesky ----------

const PDS = "https://bsky.social/xrpc";

/** Bluesky links need a facet with UTF-8 byte offsets. */
function linkFacet(text, label, uri) {
  const enc = new TextEncoder();
  const start = enc.encode(text.slice(0, text.lastIndexOf(label))).length;
  return {
    index: { byteStart: start, byteEnd: start + enc.encode(label).length },
    features: [{ $type: "app.bsky.richtext.facet#link", uri }],
  };
}

async function postToBluesky(fomo, text, link, report) {
  const identifier = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password) return console.log("Bluesky: credentials not set, skipping.");

  const session = await getJson(`${PDS}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const auth = { authorization: `Bearer ${session.accessJwt}` };

  const record = { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString(), langs: ["en"] };
  if (withLink) {
    // The link card uses the site's own OG image, which shows today's number.
    let thumb;
    try {
      const img = await fetch(`${SITE}/og.png`);
      if (img.ok) {
        const up = await getJson(`${PDS}/com.atproto.repo.uploadBlob`, {
          method: "POST",
          headers: { ...auth, "content-type": "image/png" },
          body: Buffer.from(await img.arrayBuffer()),
        });
        thumb = up.blob;
      }
    } catch (err) {
      console.warn(`Bluesky: no card image: ${err}`);
    }
    record.facets = [linkFacet(text, report, `${SITE}/report.pdf`), linkFacet(text, link, SITE)];
    record.embed = {
      $type: "app.bsky.embed.external",
      external: {
        uri: SITE,
        title: `AI FOMO Index: ${fomo.score} · ${fomo.label}`,
        description: "An exploratory index of activity in selected AI-news sources.",
        ...(thumb && { thumb }),
      },
    };
  }
  const out = await getJson(`${PDS}/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ repo: session.did, collection: "app.bsky.feed.post", record }),
  });
  console.log(`Bluesky: posted ${out.uri}`);
}

async function main() {
  const fomo = await loadIndex();
  const reason = reasonToPost(fomo);
  if (!reason) {
    console.log(`Not a posting day (score ${fomo.score}). Use --force to post anyway.`);
    return;
  }
  const { text, link, report } = compose(fomo, reason);
  if (dryRun) {
    console.log(`${text}\n\n(${text.length} characters)`);
    return;
  }
  // One network failing must not stop the other.
  const results = await Promise.allSettled([
    !only || only === "x" ? postToX(text) : undefined,
    !only || only === "bluesky" ? postToBluesky(fomo, text, link, report) : undefined,
  ]);
  const failed = results.filter((r) => r.status === "rejected");
  for (const f of failed) console.error(f.reason);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

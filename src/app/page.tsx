import { ResearchNotes } from "@/components/feed/research-notes";
import { preload } from "react-dom";
import { FeedView } from "@/components/feed/feed-view";
import { DAY } from "@/components/feed/feed-utils";
import { getFeed, getFomoIndex, getUpdatedAt } from "@/lib/dataset";
import { REPO, feedJsonUrl } from "@/lib/site";
import { METHOD_VERSION } from "@/lib/fomo-index";
import { JsonLd, ORGANIZATION, absoluteUrl, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "/",
  "AI FOMO Index · An open research project",
  "An exploratory index of AI-news activity, with open data, a reproducible method and sensitivity analysis.",
);

/**
 * Days of stories inlined into the HTML: enough for the first screens and the
 * sidebar cards (the widest looks back 30 days). The rest comes from feed.json.
 */
const INLINE_DAYS = 30;
const INLINE_MIN = 40;

export default async function HomePage() {
  const items = await getFeed();
  const updatedAt = await getUpdatedAt(items);
  const fomo = await getFomoIndex(items, updatedAt);

  // Newest first, so the recent window is a prefix.
  const cut = items.findIndex((it) => updatedAt - it.ts > INLINE_DAYS * DAY);
  const initial = cut === -1 ? items : items.slice(0, Math.max(cut, INLINE_MIN));
  // Start the download alongside the JS bundles instead of after hydration.
  if (initial.length < items.length) {
    preload(feedJsonUrl(updatedAt), { as: "fetch", crossOrigin: "anonymous", fetchPriority: "low" });
  }

  const day = (ts: number) => new Date(ts).toISOString().slice(0, 10);
  const json = (name: string, path: string, description: string) => ({
    "@type": "DataDownload",
    name,
    description,
    encodingFormat: "application/json",
    contentUrl: absoluteUrl(path),
  });

  return (
    <>
      <JsonLd
        data={{
          "@type": "Dataset",
          name: "AI FOMO Index: AI-news activity corpus and weekly index",
          description:
            `A ${items.length.toLocaleString("en")}-record corpus of AI-news headlines from lab blogs, publishers and Hacker News, with a reproducible weekly index (method v${METHOD_VERSION}) of news velocity, lab activity, community attention and topic spikes. ` +
            `As of ${day(updatedAt)} the index reads ${fomo.now.score} (${fomo.now.band.label}). Exploratory; it does not measure technological progress or sentiment.`,
          url: absoluteUrl("/"),
          sameAs: REPO,
          version: METHOD_VERSION,
          isAccessibleForFree: true,
          license: `${REPO}/blob/main/LICENSE`,
          creator: { "@id": ORGANIZATION["@id"] },
          dateModified: new Date(updatedAt).toISOString(),
          temporalCoverage: `${day(items[items.length - 1].ts)}/${day(updatedAt)}`,
          keywords: ["AI news", "artificial intelligence", "LLM releases", "news index", "time series", "Hacker News"],
          variableMeasured: fomo.now.signals.map((s) => s.label),
          measurementTechnique: absoluteUrl("/methodology"),
          distribution: [
            json("fomo.json", "/fomo.json", "Current score, signals, drivers and daily history."),
            json("research.json", "/research.json", "Research snapshot with source coverage, diagnostics and file hashes."),
            json("feed.json", "/feed.json", "Every record in the corpus."),
          ],
        }}
      />
      <FeedView initial={initial} total={items.length} fomo={fomo} researchNotes={<ResearchNotes />} builtAt={Date.now()} updatedAt={updatedAt} />
    </>
  );
}

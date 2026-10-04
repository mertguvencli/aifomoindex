import { preload } from "react-dom";
import { FeedView } from "@/components/feed/feed-view";
import { DAY } from "@/components/feed/feed-utils";
import { getFeed, getUpdatedAt } from "@/lib/dataset";
import { feedJsonUrl } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "/feed",
  "Corpus explorer · AI FOMO Index",
  "Explore the headlines, sources and topics behind the AI FOMO Index research dataset.",
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

  // Newest first, so the recent window is a prefix.
  const cut = items.findIndex((it) => updatedAt - it.ts > INLINE_DAYS * DAY);
  const initial = cut === -1 ? items : items.slice(0, Math.max(cut, INLINE_MIN));
  // Start the download alongside the JS bundles instead of after hydration.
  if (initial.length < items.length) {
    preload(feedJsonUrl(updatedAt), { as: "fetch", crossOrigin: "anonymous", fetchPriority: "low" });
  }

  return (
    <FeedView initial={initial} total={items.length} builtAt={Date.now()} updatedAt={updatedAt} />
  );
}

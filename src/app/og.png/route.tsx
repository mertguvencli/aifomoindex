import { getFeed, getFomoIndex, getUpdatedAt } from "@/lib/dataset";
import { ogCard } from "@/lib/og-card";

// The share preview, rendered once per build so it always shows the current score.
// A route (not opengraph-image.tsx) so the static export emits a real .png file,
// which GitHub Pages serves with an image content type.
export const dynamic = "force-static";

export async function GET() {
  const items = await getFeed();
  const { now, weekAgo, history } = await getFomoIndex(items, await getUpdatedAt(items));
  return ogCard({ score: now.score, weekAgo, at: now.at, history });
}

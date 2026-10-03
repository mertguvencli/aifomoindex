import { getFeed, getFomoIndex, getUpdatedAt } from "@/lib/dataset";

// A shields.io endpoint badge: https://img.shields.io/endpoint?url=<site>/badge.json
export const dynamic = "force-static";

const COLOR = { chill: "0ea5e9", aware: "10b981", anxious: "f59e0b", fomo: "f43f5e" } as const;

export async function GET() {
  const items = await getFeed();
  const { now } = await getFomoIndex(items, await getUpdatedAt(items));
  return Response.json({
    schemaVersion: 1,
    label: "AI FOMO Index",
    message: `${now.score} · ${now.band.label}`,
    color: COLOR[now.band.id],
  });
}

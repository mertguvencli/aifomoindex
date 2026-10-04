import { getCoverage, getFeed, getFomoIndex, getUpdatedAt } from "@/lib/dataset";
import { getResearchSnapshot } from "@/lib/research";

export const dynamic = "force-static";

export async function GET() {
  const items = await getFeed();
  const [fomo, coverage] = await Promise.all([getFomoIndex(items, await getUpdatedAt(items)), getCoverage()]);
  return Response.json(await getResearchSnapshot(items, fomo, coverage));
}

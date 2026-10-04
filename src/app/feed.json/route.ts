import { getFeed } from "@/lib/dataset";

// The whole feed as a static file. The home page inlines only recent stories and
// fetches this after hydration, so its HTML stays small as the archive grows.
export const dynamic = "force-static";

export async function GET() {
  return Response.json(await getFeed());
}

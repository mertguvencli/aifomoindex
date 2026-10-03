import type { MetadataRoute } from "next";
import { getFeed, getUpdatedAt } from "@/lib/dataset";
import { PAGES, absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date(await getUpdatedAt(await getFeed()));
  return PAGES.map(({ path, priority, changeFrequency }) => ({ url: absoluteUrl(path), lastModified, changeFrequency, priority }));
}

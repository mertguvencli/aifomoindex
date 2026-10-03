import type { Metadata } from "next";
import { REPO, SITE_URL } from "@/lib/site";

export const SITE_NAME = "AI FOMO Index";
export const SITE_DESCRIPTION =
  "An open research project measuring relative activity in a selected AI-news corpus. Explore the method, data and sensitivity checks.";

/** Indexable pages, in sitemap order. /dashboard is an alias of / and stays out. */
export const PAGES = [
  { path: "/", priority: 1, changeFrequency: "hourly" },
  { path: "/history", priority: 0.8, changeFrequency: "daily" },
  { path: "/methodology", priority: 0.8, changeFrequency: "monthly" },
  { path: "/feed", priority: 0.7, changeFrequency: "hourly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
] as const;

const OG_IMAGES = [{ url: "/og.png", width: 1200, height: 630, alt: "AI FOMO Index research observation" }];

/**
 * Per-page metadata with a canonical URL. A page's openGraph replaces the
 * layout's wholesale, so the shared fields are repeated here.
 */
export function pageMetadata(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { siteName: SITE_NAME, type: "website", url: path, title, description, images: OG_IMAGES },
  };
}

export const absoluteUrl = (path: string) => `${SITE_URL}${path === "/" ? "/" : path}`;

export const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "AI FOMO Index contributors",
  url: absoluteUrl("/"),
  sameAs: [REPO],
};

/** Renders schema.org data; `<` is escaped so a headline can't close the script tag. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c") }}
    />
  );
}

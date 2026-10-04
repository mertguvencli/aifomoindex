import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { Element, Root, RootContent } from "hast";
import { REPO } from "@/lib/site";
import "katex/dist/katex.min.css";
import { JsonLd, ORGANIZATION, absoluteUrl, pageMetadata } from "@/lib/seo";
import { METHOD_VERSION } from "@/lib/fomo-index";

export const metadata: Metadata = pageMetadata(
  "/methodology",
  "Methodology · AI FOMO Index",
  "The exact arithmetic behind the AI FOMO Index: windows, smoothed ratios, the r⁴ curve, the topic spike and the weighted mean, with a worked example.",
);

const SOURCE = `${REPO}/blob/main/src/lib/fomo-index.ts`;

/** Wraps each table in `.typeset-scroll`, so wide tables scroll instead of squeezing. */
function rehypeScrollTables() {
  const text = (node: Root | RootContent): string => node.type === "text" ? node.value : "children" in node ? node.children.map(text).join("") : "";
  const walk = (node: Root | Element) => {
    node.children = node.children.map((child) => {
      if (child.type !== "element") return child;
      if (/^h[1-6]$/.test(child.tagName)) child.properties.id = text(child).toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
      if (child.tagName === "table") {
        return { type: "element", tagName: "div", properties: { className: ["typeset-scroll"] }, children: [child] };
      }
      walk(child);
      return child;
    });
  };
  return walk;
}

/** Markdown + LaTeX → static HTML at build time, so the page needs no client-side math rendering. */
async function render(): Promise<string> {
  const md = await readFile(path.join(process.cwd(), "src/content/methodology.md"), "utf8");
  const html = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeScrollTables)
    .use(rehypeStringify)
    .process(md);
  return String(html);
}

const link = "underline decoration-gray-300 underline-offset-2 hover:text-gray-900 hover:decoration-gray-500";

export default async function MethodologyPage() {
  const html = await render();
  return (
    <main className="mx-auto max-w-3xl overflow-x-clip px-4 pb-20 pt-8 sm:px-6">
      <JsonLd
        data={{
          "@type": "TechArticle",
          headline: "AI FOMO Index methodology",
          description: metadata.description,
          url: absoluteUrl("/methodology"),
          version: METHOD_VERSION,
          inLanguage: "en",
          author: { "@id": ORGANIZATION["@id"] },
          publisher: { "@id": ORGANIZATION["@id"] },
          isBasedOn: SOURCE,
        }}
      />
      <header>
        <h1 className="font-serif text-4xl leading-tight text-gray-900 sm:text-5xl">Method, assumptions & limits</h1>
        <p className="mt-3 max-w-2xl text-lg leading-snug text-gray-700">
          The arithmetic, its limitations and the next experiment. The reference implementation is in{" "}
          <a href={SOURCE} target="_blank" rel="noopener noreferrer" className={link}>
            fomo-index.ts
          </a>
          .
        </p>
      </header>

      <article className="typeset typeset-docs mt-10" dangerouslySetInnerHTML={{ __html: html }} />

      <footer className="mt-14 border-t border-gray-100 pt-6 text-[15px] leading-relaxed text-gray-600">
        Every formula on this page is implemented in{" "}
        <a href={SOURCE} target="_blank" rel="noopener noreferrer" className={link}>
          src/lib/fomo-index.ts
        </a>
        . Think a weight or the curve is wrong?{" "}
        <a href={REPO} target="_blank" rel="noopener noreferrer" className={link}>
          Open a PR
        </a>{" "}
        with your backtest.
      </footer>
    </main>
  );
}

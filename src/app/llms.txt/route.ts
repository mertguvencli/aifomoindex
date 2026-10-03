import { getFeed, getFomoIndex, getUpdatedAt } from "@/lib/dataset";
import { METHOD_VERSION } from "@/lib/fomo-index";
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/seo";
import { REPO } from "@/lib/site";

// https://llmstxt.org: a plain summary for language models, rebuilt with each data refresh.
export const dynamic = "force-static";

export async function GET() {
  const items = await getFeed();
  const updatedAt = await getUpdatedAt(items);
  const { now, weekAgo } = await getFomoIndex(items, updatedAt);
  const day = (ts: number) => new Date(ts).toISOString().slice(0, 10);
  const signals = now.signals.map((s) => `- ${s.label}: ${s.score} (weight ${s.weight})`).join("\n");

  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

As of ${day(updatedAt)}, the AI FOMO Index reads ${now.score}/100 (${now.band.label})${weekAgo == null ? "" : `, compared with ${weekAgo} a week earlier`}. ${now.band.verdict}

The index compares the latest seven days of a ${items.length.toLocaleString("en")}-record AI-news corpus (since ${day(items[items.length - 1].ts)}) with the average week of the previous 28 days. 50 is the reference level. Bands: Low activity (0–34), Near baseline (35–54), Elevated (55–74), High activity (75–100). Method v${METHOD_VERSION}.

Current signals:
${signals}

Status: exploratory working study. The index describes a selected corpus; it does not measure technological progress, human anxiety or real-world impact.

## Pages

- [Research overview](${absoluteUrl("/")}): current score, signals and the stories driving them
- [Methodology](${absoluteUrl("/methodology")}): exact arithmetic with a worked example
- [Historical reconstruction](${absoluteUrl("/history")}): weekly index since late 2022 and the biggest weeks
- [Corpus explorer](${absoluteUrl("/feed")}): headlines, sources and topics
- [Research brief](${absoluteUrl("/about")}): question, scope, limitations

## Data

- [fomo.json](${absoluteUrl("/fomo.json")}): current score, signals, drivers and daily history
- [research.json](${absoluteUrl("/research.json")}): source coverage, diagnostics and file hashes
- [feed.json](${absoluteUrl("/feed.json")}): every record in the corpus
- [Source code](${REPO}): pipeline, index implementation and dataset
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

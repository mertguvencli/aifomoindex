import { Badge } from "@/components/ui/badge";
import { BASE_PATH, REPO } from "@/lib/site";
import { METHOD_VERSION } from "@/lib/fomo-index";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata = pageMetadata(
  "/about",
  "Research brief · AI FOMO Index",
  "Research question, scope, limitations and contribution agenda for an exploratory AI-news index.",
);
const link =
  "underline decoration-gray-300 underline-offset-4 hover:text-foreground hover:decoration-foreground/50";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <header className="mb-10">
        <Badge variant="outline" className="tracking-wide text-muted-foreground">
          Working study · Method v{METHOD_VERSION}
        </Badge>
        <h1 className="mt-4 font-serif text-4xl sm:text-5xl">
          A research brief.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-gray-600">
          AI FOMO Index is an open investigation into the changing intensity of
          AI news. The name describes the question that motivated the project;
          the score does not measure anyone&apos;s fear of missing out.
        </p>
      </header>
      <article className="space-y-9 text-base leading-relaxed text-gray-600">
        <section>
          <h2 className="mb-3 font-serif text-3xl text-gray-900">
            Research question
          </h2>
          <p>
            Can observable news volume, publisher activity, community attention
            and topic growth form a useful descriptive index of a selected
            AI-news corpus? What changes when the sources, weights or
            classification method change?
          </p>
        </section>
        <section>
          <h2 className="mb-3 font-serif text-3xl text-gray-900">
            Current approach
          </h2>
          <p>
            A deterministic baseline compares the most recent seven days with
            the previous 28 days. Four signals are transformed and combined. The
            score describes relative activity in those sources, not
            technological capability, social impact, personal relevance or
            sentiment.
          </p>
          <p className="mt-3">
            The descriptive band names now refer to activity. The numerical
            baseline remains unchanged, and legacy band IDs remain in the JSON
            for compatibility. Read the{" "}
            <a className={link} href={`${BASE_PATH}/methodology`}>
              full methodology
            </a>{" "}
            for assumptions and exact arithmetic.
          </p>
        </section>
        <section>
          <h2 className="mb-3 font-serif text-3xl text-gray-900">
            What the evidence supports
          </h2>
          <p>
            The repository contains a collected corpus, a historical
            reconstruction and reproducible calculations. The current snapshot
            includes equal-weight, signal-exclusion and source-exclusion checks.
            Those checks measure dependence on specified choices; they do not
            establish construct validity.
          </p>
          <p className="mt-3">
            There is no independent human benchmark yet. Retrospective agreement
            with memorable announcements is descriptive evidence, not a held-out
            validation result. Backfilled headlines and later Hacker News scores
            are not what an observer necessarily knew at the historical date.
          </p>
        </section>
        <section>
          <h2 className="mb-3 font-serif text-3xl text-gray-900">
            The semantic experiment
          </h2>
          <p>
            Jev / System One is a candidate for assessing headline relevance,
            reported changes and specificity. Its structured outputs make these
            judgments inspectable, but correct output types do not guarantee
            correct judgments. A separate pilot records exact inputs, rubric,
            model version and returned distributions. It contributes no weight
            to the baseline.
          </p>
          <p className="mt-3">
            The first task is a human-annotated comparison, including unclear
            and irrelevant headlines. Measuring novelty or impact would require
            richer evidence and a separate rubric.{" "}
            <a
              className={cn(link, "block")}
              href={`${BASE_PATH}/methodology#semantic-experiment`}
            >
              Read the protocol →
            </a>
          </p>
        </section>
        <section>
          <h2 className="mb-3 font-serif text-3xl text-gray-900">
            An invitation to investigate
          </h2>
          <p>
            Contributions can audit source coverage, label a sample, test event
            deduplication or compare another specification. Negative results and
            documented disagreements are useful contributions. Proposed changes
            should preserve a frozen baseline and report what changes across the
            full evaluation set.
          </p>
          <p className="mt-3">
            <a className={link} href={`${REPO}/blob/main/CONTRIBUTING.md`}>
              Contribution guide
            </a>{" "}
            ·{" "}
            <a className={link} href={`${BASE_PATH}/research.json`}>
              Research snapshot
            </a>{" "}
            ·{" "}
            <a className={link} href={`${BASE_PATH}/feed`}>
              Corpus explorer
            </a>
          </p>
        </section>
        <section className="border-t border-gray-200 pt-6 text-sm">
          <h2 className="mb-2 font-medium text-gray-900">Reuse & citation</h2>
          <p>
            Code is MIT; data is CC BY 4.0. Cite the project, method version,
            observation date and repository commit. Archive the JSON snapshots
            with the commit when using results in another study. This is an
            exploratory working study; no peer-review or DOI status is implied.
          </p>
        </section>
      </article>
    </main>
  );
}

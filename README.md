<p align="center">
  <img src=".github/assets/cover.jpg" alt="AI FOMO Index — An open study of the pace of AI news." width="100%">
</p>

## Is AI actually moving faster, or does it just feel that way?

**AI FOMO Index is an open research project that tracks the changing pace of the AI information environment.**

It combines news velocity, AI lab activity, community attention and topic spikes into a transparent, reproducible index. The underlying corpus, formula, historical reconstruction and sensitivity checks are open for inspection.

> **The formula is open. Argue with it.**

[Research overview](https://aifomoindex.com) · [Methodology](https://aifomoindex.com/methodology) ·
[Corpus](https://aifomoindex.com/feed) · [Historical reconstruction](https://aifomoindex.com/history)

> **Research status:** Exploratory working study. The index describes changes in a selected AI-news corpus. It does not measure technological progress, human anxiety, personal relevance or real-world impact. No independent validation or peer-review status is claimed.

## What the study is showing

The project separates two questions that can otherwise be easy to conflate:

- **How busy is AI news this week compared with the recent past?**
- **How active is the tracked information environment compared with the first tracked year?**

The live research overview publishes the current observation, the long-run reconstruction, signal-level detail, source composition and sensitivity checks. Because the observation changes as new records are collected, the website and versioned machine-readable artifacts are the source of truth for the latest values.

**Latest observation:** [aifomoindex.com](https://aifomoindex.com)

The goal is not to turn one score into a claim about AI progress. It is to make the assumptions behind a description of AI-news activity explicit enough to inspect, reproduce and challenge.

## Reproduce it yourself

The baseline is deterministic and can be reproduced from the checked-in data.

```sh
npm ci
npm test
npm run backtest
npm run build
```

**No API key is required to reproduce the baseline.**

Use the same repository commit and input data to reproduce an observation. Versioned JSON outputs and file fingerprints make it possible to inspect exactly what went into a published result.

## Baseline: method v1.1.0

The latest seven days are compared with the average week of the previous 28 days.
For each signal, $r$ is this week's count divided by the baseline week's count,
with 2 added to both (a *pseudocount*) so tiny numbers can't produce huge jumps.
For example, 260 stories against a baseline of 200 gives $r = 262/202 \approx 1.30$.

Each ratio is transformed onto a 0–100 scale:

```math
S(r) = 100 \cdot \frac{r^4}{1+r^4}
```

A normal week ($r = 1$) scores 50, twice the usual pace scores 94 and half the
usual pace scores 6; the example above scores 74.

The four transformed signals are combined as:

```math
\mathrm{FOMO} = 0.30\,S(r_{\text{news}}) + 0.25\,S(r_{\text{lab}}) + 0.25\,S(r_{\text{community}}) + 0.20\,S(r_{\text{topic}})
```

| Signal | Weight | Operational definition |
| --- | ---: | --- |
| News velocity | 0.30 | Collected records from eligible sources |
| Lab activity | 0.25 | Lab-source headlines matching model, product, agent, media or robotics keywords |
| Community attention | 0.25 | Records with 200+ stored HN points; legacy importance fallback where points are absent |
| Topic spike | 0.20 | Largest eligible topic ratio relative to earlier weekly maximum ratios |

A score of **50** is the reference level because $S(1)=50$.

**The composite cannot be inverted into one pace multiplier.** Bands are
descriptive: Low activity (0–34), Near baseline (35–54), Elevated (55–74),
High activity (75–100). Legacy JSON IDs (`chill`, `aware`, `anxious`, `fomo`)
remain for compatibility; numerical scores are unchanged by the
research-presentation revision.

[Exact method and limitations](src/content/methodology.md) · [Implementation](src/lib/fomo-index.ts)
## Evidence and limitations

- The source mix favors English-language, developer-facing coverage. Inclusion
  and topic classification use imperfect query and keyword rules.
- Signals overlap. URL deduplication does not merge every report of one event.
- Coverage dates are declared collection boundaries, not audited completeness.
- History is reconstructed using retrospectively collected data, including
  later HN scores. It is not a simulation of information available in real time.
- Recognizable historical peaks are descriptive checks, not held-out validation.
- The overview shows equal-weight, leave-one-signal-out and leave-one-source-out
  checks for the current observation. Their range is **not a confidence interval**.
- Existing `importance` values mix legacy model and heuristic annotations without
  per-record provenance. They are not human-validated labels.

## Reproduce

Use Node.js 24 (`.nvmrc`). The build verifies that all static artifacts actually
exist, in addition to lint and type checks.

```sh
npm ci
npm test
npm run backtest
npm run build
npm run dev
```

No API key is required to reproduce the baseline from the checked-in data.
Use the same repository commit and data to reproduce an observation. The static
export includes:

| Artifact | Contents |
| --- | --- |
| `/fomo.json` | Score, method version, signals, example headlines, daily reconstruction |
| `/research.json` | File hashes, source composition, sensitivity specifications and results |
| `/report.pdf` | Printable observation report |
| `/feed.json` | Normalized corpus |
| `/badge.json`, `/og.png` | Reusable visual summaries |

Cite **AI FOMO Index, method version, observation date and repository commit**.
Archive the JSON outputs alongside that commit. A checksum identifies an input;
it does not replace archiving it. Each GitHub release is archived on Zenodo:
[10.5281/zenodo.23144696](https://doi.org/10.5281/zenodo.23144696) resolves to the
latest version, and each version has its own DOI on that page.
The corpus is also on Hugging Face as Parquet, synced daily:
[mertguvencli/aifomoindex](https://huggingface.co/datasets/mertguvencli/aifomoindex).

## Semantic experiment: Jev / System One

Headline-only Jev annotations cover relevance, reported change and specificity.
A separate pilot prepares blind human-label templates for evaluating these outputs.
It saves exact inputs, rubric and input hashes, the pinned model version, returned
probability distributions and usage. **No semantic result changes the index.**

```sh
# Offline: write requests and blank human labels, no external API calls.
npm run semantic:pilot -- --limit=20

# Explicit network run; reads TYPESAFE_API_KEY from the environment or .env.
# Requires an accessible pinned model and a fresh output directory.
npm run semantic:pilot -- --limit=20 --execute
```

The default model is `jev-1.13.0`; change it explicitly with `--model=jev-X.Y.Z`
when evaluating another published version. There is no automatic alias upgrade,
retry in the pilot. Local pilot outputs go to ignored
`experiments/runs/` directories. Publish a reviewed release separately.

For the full corpus and subsequent incremental updates:

```sh
# OPENROUTER_KEY (or OPENROUTER_API_KEY) in .env
npm run semantic:corpus -- --execute
```

Versioned outputs are appended to `data/semantic/annotations.jsonl`. Completed
inputs are reused on rerun; changed headlines or requests get new annotations.
The six-hour GitHub pipeline invokes this command after crawling. Set the Actions
repository secret **OPENROUTER_KEY** (or **OPENROUTER_API_KEY**). Push the initial
journal with the workflow so scheduled runs reuse the historical backfill.
See `data/semantic/summary.json` for coverage; model labels are not human validation.

**Jev v2 (`jev-excerpts-v2`).** During each crawl, new items are also annotated
from their headline *and* the source-provided excerpt (RSS description or page
meta description), with an extra `significance` question (`major`, `minor`,
`insufficient`). The excerpt is used only at annotation time; the journal in
`data/semantic/v2/` keeps its hash and length, never its text. History was
annotated once with `npm run backfill:jev` (in `pipeline/`), using feed
descriptions or re-fetched page descriptions; those rows are `mode: "backfill"`
and retrospective. v2 carries zero index weight until it is compared against
headline-only v1 on human labels.

[Protocol, labels and evaluation plan](docs/semantic-pilot.md)

## Think the index is wrong?

Good.

Maybe Hacker News is overweighted. Maybe the 28-day baseline is too short. Maybe lab activity deserves a different weight. Maybe the topic-spike definition should change. Maybe “FOMO” needs a better measurable proxy.

**Fork it. Change the assumptions. Run the backtest. Show the result.**

Useful contributions include:

- alternative specifications with reproducible comparisons;
- relevance and source-coverage audits;
- independent or human annotations;
- event deduplication approaches;
- new measurable signals or source proposals;
- negative results that reveal where an apparently better method does not hold up.

The goal is not to defend the current formula. It is to make the measurement more transparent and more useful.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[code of conduct](CODE_OF_CONDUCT.md). Report security issues privately; see
[SECURITY.md](SECURITY.md). Preserve the baseline when proposing a new method
and include a reproducible comparison rather than selected peak dates.

## Collection and infrastructure

AI FOMO Index is an open, non-commercial research project studying changes in
the pace of the AI information environment.

The collection pipeline runs periodically through GitHub Actions as part of the
repository's research and publication workflow. It refreshes the public corpus
and regenerates the reproducible research artifacts published by this project.

The crawler normally runs every six hours and is intentionally conservative:

- respects `robots.txt`;
- identifies itself as `aifomoindex-bot`;
- rate-limits requests per host;
- stops requesting a host after HTTP 403 or 429 responses;
- does not republish article bodies;
- collects only the metadata required for the study.

The crawler is not offered as a standalone scraping service and is not intended
for bulk crawling or commercial data extraction.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [data/README.md](data/README.md) for
implementation and dataset details. Social-posting code is optional and requires
separate credentials; its presence does not imply an active public account.

```sh
cd pipeline
npm ci
npm run crawl
```

To request exclusion of a source, open an issue or propose a `blockedHosts`
entry in `pipeline/sources.config.json`.
## License

Code: [MIT](LICENSE). Data: [CC BY 4.0](data/LICENSE). Third-party headlines and
linked articles remain attributable to their publishers.

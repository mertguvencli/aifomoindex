# AI FOMO Index

**An open research project on the changing pace of AI news.**

Can news volume, publisher activity, community attention and topic growth form a
transparent description of a selected AI-news corpus? This repository publishes
a deterministic baseline, the underlying records and a proposal for a separate
semantic annotation experiment.

**Status: exploratory working study.** The index does not measure technological
progress, human anxiety, personal relevance or real-world impact. No independent
validation or peer-review status is claimed.

[Research overview](https://aifomoindex.com) · [Methodology](https://aifomoindex.com/methodology) ·
[Corpus](https://aifomoindex.com/feed) · [Historical reconstruction](https://aifomoindex.com/history)

## Baseline: method v1.0.0

The latest seven days are compared with the average week of the previous 28 days.
Count ratios are smoothed with a pseudocount of 2 and transformed using
`100 * r^4 / (1 + r^4)`. The four transformed signals are combined:

| Signal | Weight | Operational definition |
| --- | ---: | --- |
| News velocity | 0.30 | Collected records from eligible sources |
| Lab activity | 0.25 | Lab-source headlines matching model, product or agent keywords |
| Community attention | 0.25 | Records with 200+ stored HN points; legacy importance fallback where points are absent |
| Topic spike | 0.20 | Largest eligible topic ratio relative to earlier weekly maximum ratios |

50 is the reference level. **The composite cannot be inverted into one pace
multiplier.** Bands are descriptive: Low activity (0–34), Near baseline (35–54),
Elevated (55–74), High activity (75–100). Legacy JSON IDs (`chill`, `aware`,
`anxious`, `fomo`) remain for compatibility; numerical scores are unchanged by
the research-presentation revision.

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
it does not replace archiving it. There is no DOI yet.

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

[Protocol, labels and evaluation plan](docs/semantic-pilot.md)

## Contribute to the study

Useful contributions include relevance audits, independent annotations, coverage
checks, event deduplication, alternative specifications and negative results.
Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[code of conduct](CODE_OF_CONDUCT.md). Report security issues privately; see
[SECURITY.md](SECURITY.md). Preserve the baseline when proposing
a new method; include a reproducible comparison rather than selected peak dates.

## Collection and infrastructure

The crawler reads Hacker News and configured feeds/pages, normally every six
hours through GitHub Actions. See [ARCHITECTURE.md](ARCHITECTURE.md) and
[data/README.md](data/README.md). Social-posting code is optional and requires
separate credentials; its presence does not imply an active public account.

```sh
cd pipeline
npm ci
npm run crawl
```

The crawler obeys robots.txt, identifies itself as `aifomoindex-bot`, limits per-host
requests and stops after a 403 or 429. Article bodies are not republished. To opt
out, open an issue or propose a `blockedHosts` entry in `pipeline/sources.config.json`.

## License

Code: [MIT](LICENSE). Data: [CC BY 4.0](data/LICENSE). Third-party headlines and
linked articles remain attributable to their publishers.

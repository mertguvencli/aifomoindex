# Semantic annotation pilot

**Protocol `jev-headlines-v1` · experimental · no published results · zero index weight.**

## Question

Can a pinned System One model annotate headline relevance and reported changes
more accurately than keyword rules, with useful uncertainty estimates?
This is not yet a test of real-world importance. A headline is insufficient to
verify the truth, novelty or consequences of an event.

## Candidate and interface

Jev is the candidate proposed for this study. The implementation follows the
[TypeSafe HTTP API](https://docs.typesafe.ai/api),
[Score primitive](https://docs.typesafe.ai/primitives/score) and
[versioned models](https://docs.typesafe.ai/models) documentation consulted on
2026-10-01. Direct TypeSafe requests use `jev-1.13.0`.
OpenRouter uses the release-specific `typesafe/jev-1.13` ID and records the
resolved dated model in each response; moving `latest` aliases are rejected.
The [OpenRouter System One API](https://openrouter.ai/docs/guides/community/typesafe-sdk)
preserves the typed interface. The release ID does not guarantee immutable weights.
Provider confidence describes its answer distribution, not empirical correctness
on this corpus. Type safety is not semantic validation.

## Inputs and questions

The model receives only the headline and publication date. Source, URL, HN votes,
legacy importance and existing tags are omitted from model state. The plan
retains source and URL for analysis; votes and legacy annotations remain in the
hashed source dataset. No articles are fetched, and no synthetic summaries are generated.
Names within headlines can still reveal the publisher or company.

| Dimension | Output | Interpretation |
| --- | --- | --- |
| Relevance | `relevant`, `unrelated`, `insufficient` | Is AI the subject, based on the headline? |
| Reported change | `reported`, `commentary`, `insufficient` | Does the headline claim a concrete AI-related change? Not a truth judgment. |
| Specificity | Ordered levels 0–2 plus their distribution | Vague; named subject; named subject with a concrete distinguishing detail |

The exact questions and anchored descriptions live in `scripts/semantic/jev.mjs`.
Each request and rubric is hashed. Specificity treats ordinal levels as equally
spaced for the returned expected value; this is a convenience, not a physical scale.
A forced specificity score is not a substitute for the other questions' explicit
insufficient-information outcomes. Do not multiply these outputs into an impact
score or equate confidence with reliability.

## Run

```sh
npm ci
npm run semantic:pilot -- --limit=20 --days=35
```

Default execution is offline: it writes a `plan.json` and blank `human-labels.json`
to a new directory under `experiments/runs/`. It needs no key or account. Sampling
uses the dataset's latest first-seen timestamp; records within the window are
ordered by a protocol-seeded hash within each source, then selected round-robin.
This source-balanced diagnostic sample is **not** a random prevalence estimate.
The exact selected IDs are saved. Defaults: 20 records, 35 days. Hard cap: 500
records per invocation. A larger research corpus should be explicitly designed.

For an actual run, configure `TYPESAFE_API_KEY` locally and use:

```sh
npm run semantic:pilot -- --limit=20 --days=35 --execute
```

For OpenRouter, set `OPENROUTER_KEY` (or `OPENROUTER_API_KEY`) in `.env` and run:

```sh
npm run semantic:pilot -- --provider=openrouter --limit=20 --days=35 --execute
```

The script loads `.env` with Node's native parser, without shell evaluation;
existing process environment values take precedence. Keys are sent only to the
selected provider's fixed endpoint. Direct TypeSafe remains the default.
Response validation allows the arithmetic error implied by two-decimal rounding
of probabilities and scores; raw values are preserved without renormalization.
Malformed responses are saved separately as `invalid-response.json` before stopping.
Use a fresh `--out=...` directory for each run. It never overwrites prior outputs.
The script performs one sequential request per selected record, with a timeout,
no automatic retries and no fallback labels. A failure records the failed ID and
completed count, then stops. A timeout can still have incurred provider usage.

Successful results save the raw validated response, resolved model, distributions,
confidence, usage, timestamps and input hash in `results.jsonl`. The plan saves
exact request bodies and dataset/ledger hashes. There is no automatic publication,
index integration or scheduled run. API credentials are not recorded. Review
outputs before including them in a versioned release.

## Human evaluation before aggregation

1. Freeze the corpus commit, rubric and a source/time-stratified evaluation plan.
   The existing command prepares a pilot, not a preregistered benchmark.
2. Have at least two independent annotators label the same evidence, blinded to
   model results. Retain original labels, disagreement and adjudication. The
   blank template deliberately excludes model answers and source popularity.
3. Separate development and held-out evaluation, preferably by time; cluster
   multiple reports of one event into the same split. Do not optimize the rubric
   or thresholds using the held-out labels.
4. Compare relevance to keyword baselines. Report class counts, per-class
   precision/recall and macro-F1, including insufficient cases. If using confidence
   for abstention, report coverage and errors together; pick thresholds on the
   development split. Report Brier score and reliability diagrams against labels.
   For specificity, report ordinal agreement and absolute error, not just correlation.
5. Break results down by source and date. Test repeatability, paraphrases and a
   second pinned model. Historical events may be present in model training;
   historical annotations must be labeled retrospective.
6. Record costs and failures. Publish anonymized labels, requests, outputs, code,
   model/rubric versions and limitations, subject to the providers' terms.

Only after evaluation should a separate semantic time series be proposed. It
needs comparable annotation coverage in both current and baseline windows.
Missing outputs are missing, not zero. Preserve the original series and report
sensitivity to aggregation weights before considering a new composite version.

## Background

[Zheng et al. (2023)](https://arxiv.org/abs/2306.05685) documents judge-model biases
in conversational evaluation. It motivates a domain-specific audit; it does not
validate our news questions. [TypeSafe's confidence documentation](https://docs.typesafe.ai/confidence)
explains the provider-returned statistic. Neither replaces human evaluation.

## Full-corpus annotation and scheduled updates

The corpus runner is separate from the diagnostic pilot:

```sh
npm run semantic:corpus                    # inspect pending work without API calls
npm run semantic:corpus -- --execute       # annotate all missing inputs
```

It loads `.env` and accepts `OPENROUTER_KEY` or `OPENROUTER_API_KEY`. Each annotation
in `data/semantic/annotations.jsonl` is keyed by record ID and the hash of the
exact model request (headline, date, model and rubric). Unchanged requests are
validated and reused; changed inputs produce a new appended version. Model
answers do not replace existing source data, tags or baseline index values.
`summary.json` covers only the current dataset, not superseded annotations.

The GitHub `pipeline` workflow runs annotation after each crawl, every six hours.
Add a repository Actions secret named **OPENROUTER_KEY** (the conventional
**OPENROUTER_API_KEY** name is also accepted). The key stays server-side and is
never passed to the web build or saved in annotation files. Commit and push the
runner, workflow and initial annotation journal together to avoid reprocessing
the historical corpus on the first scheduled run.

Eight concurrent requests run by default (configurable from 1 to 16); `--limit=N`
can bound a batch. On any failure, no new requests are started, while in-flight
requests finish and save their results. Successful rows are appended immediately.
There are no automatic retries; rerunning processes remaining inputs. Timeouts
or a crash after provider completion but before a saved response can incur a
charge again; this is not an exactly-once billing guarantee.

Failures are retained in `failures.jsonl`. The workflow commits completed progress
and uploads a checkpoint artifact even when annotation fails, then marks the job
failed rather than presenting incomplete coverage as success. On cancellation or
job timeout, retrieve the checkpoint artifact if a commit was not reached.

A `.lock` file prevents simultaneous local writers. After a forcibly terminated
process, verify no writer is active before removing that lock. A torn final JSONL
line requires manual inspection; the runner does not silently discard it.

## v2: headline + excerpt (`jev-excerpts-v2`)

`pipeline/src/run.ts` calls `scripts/semantic/annotate-fresh.mjs` after each
crawl's finalize step, for new items only. State adds `excerpt`: the source's RSS
description or page meta description, tags stripped, whitespace collapsed, capped
at 1,500 characters and dropped if it only repeats the headline. Hacker News items
have no excerpt. Questions are v1's three, rescoped to the supplied text, plus
`significance` (`major` / `minor` / `insufficient`).

The excerpt is not written anywhere: `data/semantic/v2/annotations.jsonl` keeps
`excerptSha256` and `excerptChars`. Because the text is gone after the run, items
are attempted once; failures go to `failures.jsonl` and stay missing, and a
provider outage never fails the crawl.

The existing corpus was annotated once with `pipeline/src/backfill-jev.ts`
(resumable by id). Lab items take their description from the full configured
feeds first, then from their page; each row records `fetch` (`feed`, `ok`,
`failed`, `none` for Hacker News). Pages refused with 403/429 are not retried
in the same run, per the crawl rules. Next step: label a sample with both v1 and
v2 inputs and check whether the excerpt reduces `insufficient` answers without
hurting agreement.

All historical labels are retrospective and remain unvalidated model judgments.
Full coverage is not a measure of accuracy, calibration or real-world impact.

### Provider consistency flags

During the full run, some valid typed Choice answers selected a label that was
not the argmax of the returned distribution (for example 0.49 vs 0.50). Preserve
both the original choice and probabilities, with a `choice_not_argmax` audit flag.
This contradicts the documented Choice contract and must not be described as
verified consistency or explained away as proven rounding behavior. Such rows
count toward annotation coverage, but need review before downstream aggregation.
Invalid types, unknown labels, malformed distributions or inconsistent scores
still stop the runner. `summary.flagged` reports current records with these flags.
The initial three affected responses were recovered from the failure journal;
first judgments take precedence over subsequent retry judgments, which remain
in the append-only history. No answer was edited to force agreement.

**Status: exploratory working study. Method v1.0.0.** The index describes relative activity in a selected AI-news corpus. It does not measure technical progress, sentiment, human anxiety or the importance of keeping up. The name “FOMO” is motivational, not the measured construct.

The current baseline preserves the original arithmetic. Windows, weights, keyword rules, point thresholds, pseudocount, curve exponent and band boundaries are modeling choices, not learned or independently validated constants.

## 1. Two windows

Every reading is taken at a moment $T$, the most recent first-seen timestamp in `data/seen.json` (falling back to the newest publication date if unavailable). Around it we draw two windows:

$$
\underbrace{(T - 35\text{d},\; T - 7\text{d}\,]}_{\text{baseline: 28 days}}
\qquad
\underbrace{(T - 7\text{d},\; T\,]}_{\text{window: this week}}
$$

For any set of stories $S$, let $C$ be how many fell in this week's window and $N$ how many fell in the baseline. The baseline covers four weeks, so an average week in it holds

$$
B = \frac{7}{28}\,N = \frac{N}{4}.
$$

$C$ and $B$ are now on the same scale: stories per week.

## 2. A ratio, softened

The pace of a signal is this week against an average week:

$$
r = \frac{C + k}{B + k}, \qquad k = 2.
$$

The pseudocount $k$ keeps small signals from swinging wildly. Without it, a signal that goes from one story to three reads as $3\times$ the usual pace. With it, the same jump is

$$
r = \frac{3 + 2}{1 + 2} \approx 1.67,
$$

still a clear rise, but not a panic. For large counts $k$ barely matters: $262/202$ and $260/200$ are both $1.30$.

Ratios compare a source mix against its own recent history. Adding a source can still change the result if its activity pattern differs. A source only counts in a reading when its declared coverage starts before that reading's baseline begins, which prevents immediate entry from being treated as a spike. This does not prove that source coverage is complete or that later source admission has no effect.

## 3. From ratio to score

A ratio lives on $(0, \infty)$. The index lives on $[0, 100]$. One curve maps between them:

$$
s(r) = 100 \cdot \frac{r^4}{1 + r^4}
$$

rounded to a whole number. Some properties worth knowing:

- **A normal week scores 50.** $s(1) = 100 \cdot \tfrac{1}{2} = 50$.
- **Faster and slower are symmetric.** $s(1/r) = 100 - s(r)$, so half the pace is exactly as far below 50 as double the pace is above it.
- **It is a logistic curve in disguise.** Writing $r^4 = e^{4 \ln r}$ gives $s(r) = 100 \cdot \sigma(4 \ln r)$, where $\sigma$ is the logistic function. The score is a sigmoid of the *log* of the pace.
- **It saturates.** No single surge can push a signal past 100, and no quiet week below 0.

The exponent 4 is the steepness. Weekly AI news volume is steady, so a gentle curve ($r^2$) left most weeks bunched between 45 and 63. With $r^4$, ordinary weeks spread across roughly 40–70, and higher values become more sensitive to count changes. This choice was informed by the same historical data shown here, not a held-out validation set.

Inverting the curve gives the **smoothed ratio for one signal**, not the composite index or an absolute rate of AI progress:

$$
r(s) = \left(\frac{s}{100 - s}\right)^{1/4}
$$

| Individual signal score | Smoothed ratio |
| ---: | ---: |
| 19 | $0.70\times$ |
| 35 | $0.86\times$ |
| 50 | $1.00\times$ |
| 55 | $1.05\times$ |
| 75 | $1.32\times$ |
| 79 | $1.40\times$ |
| 90 | $1.73\times$ |

## 4. Three counting signals

Three signals are the formula above applied to a different set of stories.

| Signal | Stories counted | Weight $w$ |
| --- | --- | ---: |
| News velocity | Every story from every source | $0.30$ |
| Lab activity | Lab-source headlines matching model, product or agent keywords | $0.25$ |
| Community attention | Stories with $200+$ points on Hacker News | $0.25$ |

The lab-source group is OpenAI, Anthropic, Google AI, DeepMind, Mistral and Hugging Face. This grouping includes community posts on Hugging Face; it is not a guarantee of first-party releases. Keywords are applied to titles at build time. A lab post can match the proxy without announcing a launch. Older HN rows missing points can fall back to the legacy `importance` field (≥3), whose model/heuristic provenance was not recorded per row. For each signal, $s_i = s\!\left(\dfrac{C_i + 2}{B_i + 2}\right)$.

## 5. The topic spike

Every story carries topics such as *models*, *agents*, *hardware* or *policy*. The fourth signal asks whether any single topic is suddenly louder than usual.

Call $\mathcal{T}$ the topics with at least 5 stories this week. Compute each one's own ratio, and take the largest:

$$
R(T) = \max \left\{ \frac{C_t + 2}{B_t + 2} \;:\; t \in \mathcal{T} \right\}
$$

(If no topic reaches 5 stories, $R(T) = 1$.)

There is a catch. *Some* topic always grows fastest, so $R(T)$ sits well above 1 even in a dull week. Scoring it directly would pin this signal near the top every week. Instead, it is compared with the biggest spike of each of the four previous weeks:

$$
\bar{R} = \frac{1}{4}\sum_{j=1}^{4} R(T - 7j\ \text{days}),
\qquad
s_{\text{spike}} = s\!\left(\frac{R(T)}{\bar{R}}\right).
$$

A score of 50 now means "a typical week's biggest spike", and only an unusually sharp one scores high.

## 6. The index

The FOMO Index is the weighted mean of the four signal scores:

$$
\text{FOMO}(T) = \operatorname{round}\!\left(\frac{\sum_i w_i\, s_i}{\sum_i w_i}\right)
$$

and since the weights add up to 1, that is simply

$$
\begin{aligned}
\text{FOMO}(T) = \operatorname{round}\big(\,&0.30\,s_{\text{velocity}} + 0.25\,s_{\text{launches}} \\
{}+{} &0.25\,s_{\text{heat}} + 0.20\,s_{\text{spike}}\big).
\end{aligned}
$$

A composite score cannot be inverted to a unique news-volume multiplier: signals have different counts, overlap and undergo a nonlinear transformation before averaging. The 0–100 scale is neither a percentile nor a probability.

It falls into descriptive bands with chosen boundaries:

| Score | Band |
| --- | --- |
| $0 \leq x < 35$ | Low activity |
| $35 \leq x < 55$ | Near baseline |
| $55 \leq x < 75$ | Elevated |
| $75 \leq x \leq 100$ | High activity |

The daily history is the same reading repeated at $T,\ T - 1\text{d},\ T - 2\text{d},\ \dots$ back to November 2022. The "vs. last week" arrow compares $\text{FOMO}(T)$ with $\text{FOMO}(T - 7\text{d})$.

### Long-run level

The index above is relative to its own last month, so over years it returns to 50 by construction and cannot show a trend. The long-run level is a separate, companion measure for that. For each counting signal (velocity, launches, heat) it compares the trailing 13 weeks with the first tracked year (the 52 weeks from `historyFrom`), using only sources covered since `historyFrom`, so adding a source never looks like growth. An archive that is thinner in its early years than it is today *does* look like growth; see the coverage note in Limitations:

$$
\rho_i = \frac{Q_i + 2}{\tfrac{13}{52} Y_i + 2},
\qquad
\text{Level}(T) = \operatorname{round}\!\left(100 \cdot \exp \frac{\sum_i w_i \ln \rho_i}{\sum_i w_i}\right),
$$

where $Q_i$ is the signal's count in the 13 weeks ending at $T$ and $Y_i$ its count in the reference year. The geometric mean keeps one fast-growing, low-volume signal from dominating. The topic spike is excluded because it is relative by design. $100$ means "as active as the reference year" ($336 \to 3.4\times$).

The **Overall FOMO Index** puts that level on the same 0–100 scale and bands as the weekly index, with a gentler curve than section 3 because multi-year growth spans much larger ratios than week-to-week change:

$$
r = \text{Level}/100,\qquad \text{Overall}(T) = \operatorname{round}\!\left(\frac{100\,r}{1 + r}\right),
$$

so $1\times \to 50$, $2\times \to 67$, $3\times \to 75$, $4\times \to 80$ and $9\times \to 90$. History is weekly. The level also rises when sources simply publish more or when Hacker News grows; it is not a measure of AI progress.

## 7. A worked example

Suppose this is a week's raw data:

| Signal | $C$ | $N$ | $B = N/4$ | $r$ | $s(r)$ |
| --- | ---: | ---: | ---: | ---: | ---: |
| Velocity | 260 | 800 | 200 | $262/202 = 1.297$ | 74 |
| Lab activity | 9 | 20 | 5 | $11/7 = 1.571$ | 86 |
| Attention | 14 | 64 | 16 | $16/18 = 0.889$ | 38 |
| Spike | | | | $3.2/2.5 = 1.28$ | 73 |

Take velocity: $1.297^4 \approx 2.83$, so $s = 100 \cdot 2.83 / 3.83 \approx 74$.

The index is

$$
0.30 \cdot 74 + 0.25 \cdot 86 + 0.25 \cdot 38 + 0.20 \cdot 73
= 22.2 + 21.5 + 9.5 + 14.6 = 67.8 \;\to\; 68,
$$

which lands in **Elevated**: busier than usual, mostly because the lab-activity proxy rose, while the count of high-attention stories fell. Neither signal verifies releases or measures human emotion.

## 8. Employment mentions

The jobs signal counts headlines about jobs, layoffs, hiring and automation of work, and is scored exactly like the counting signals:

$$
s_{\text{jobs}} = s\!\left(\frac{C_{\text{jobs}} + 2}{B_{\text{jobs}} + 2}\right).
$$

Its weight is $0$: it is exported alongside the index and included in the report, but never moves the composite. Counts can be very small, so it stays experimental. It measures employment-related headlines, not labor-market conditions.

## Limitations

- It measures **news activity, not importance.** One landmark paper in a quiet week barely moves it; a week full of launches does.
- It is **relative to the last month**, not to all of history. After a long busy stretch, "busy" becomes the new normal and the index drifts back toward 50. The long-run level (section 6) is the companion measure for the trend.
- Its view of the world is the sources it reads: English-language, and leaning on Hacker News.

- Multiple headlines about one event can raise multiple signals. URL deduplication is not event deduplication; the signals are correlated.
- HN inclusion depends on a query and a points threshold. Keywords can match irrelevant stories or miss relevant ones. Stored records are not a complete census of AI news.
- Historical reconstructions use later-collected headlines and HN point totals. They are **not real-time historical forecasts**. Live HN scores are refreshed for three days, not guaranteed final totals.
- Declared coverage is not audited completeness. Backfilled archives are visibly thinner in early years for some sources (for example, OpenAI has 7 records in Q4 2022 and 464 in 2026 to date; DeepMind has 2 in Q1 2025). Part of the long-run level's rise can therefore be archive depth rather than activity. Known gaps are listed in `data/README.md`.
- Source eligibility uses declared coverage dates. Missing crawls, removed pages and changes to source publishing frequency can change the score. The first few topic-spike baselines may have limited eligible coverage.
- Historical peaks were inspected during method development. Recognizable peak dates are not independent validation. Overlapping seven-day windows also make daily observations dependent.
- The `drivers` field is a heuristic selection of example headlines, not a causal attribution or an exact decomposition of score changes. Legacy importance can be model-produced or heuristic, without recorded provenance. It can also enter the heat fallback described above.

## Sensitivity analysis

The overview and `research.json` recompute the **current snapshot** under: equal signal weights; omission of each signal with remaining weights renormalized; and omission of each eligible source from all windows, including the topic-spike reference windows. The published specification is included in the reported minimum and maximum.

This range is not a confidence interval, does not quantify sampling error and is not exhaustive. In particular, it does not vary windows, the exponent, the pseudocount, keyword lists or HN thresholds. Removing a source changes the observed population; a small score change does not prove representativeness. Full-history sensitivity and external validation remain research tasks.

## Reproducibility

`research.json` records the observation timestamp, method version, source counts, specified alternatives and SHA-256 fingerprints of the dataset, coverage, first-seen ledger and calculation code. `fomo.json` exposes the index and daily reconstruction. Reproduction requires the corresponding repository commit and data, not only a hash. Run `npm ci`, `npm run backtest` and `npm run build` from that checkout.

The timestamp is the newest first-seen record, not evidence that a crawler ran successfully at that time. Rebuilding identical files preserves the score; changing point totals or coverage can revise historical scores. Archive outputs and commits when citing a result. The method is not preregistered or independently validated.

## Semantic experiment

**Protocol: `jev-headlines-v1`. Model annotations are not human-validated; zero weight in the index.** Jev / System One uses three narrow questions: AI relevance (including an insufficient-information option), whether a concrete change is reported (including an insufficient-information option), and headline specificity on three descriptive levels. Specificity is an information-detail score, not an impact score.

Inputs are the headline and publication date. URLs, source labels, HN points and existing importance are omitted from model state to reduce direct popularity and publisher cues, although names in headlines can still reveal a publisher. Headline-only evidence cannot substantiate real-world importance, novelty, factual truth or a claim of a breakthrough.

The pilot pins a model version and stores the complete request, input and rubric hashes, full answer distributions, confidence, token usage and timestamps. Missing or malformed responses stop the experiment; they are not replaced by neutral scores. `npm run semantic:pilot` only prepares an offline plan and human-label template. An explicit `--execute` and a locally configured provider key (TypeSafe or OpenRouter) are required for API calls. Pilot outputs never alter the index automatically. A separate resumable corpus runner appends annotations to `data/semantic/annotations.jsonl`; the scheduled GitHub pipeline processes only missing or changed inputs after each crawl. Coverage is reported in `data/semantic/summary.json` and the research snapshot. Historical annotations are retrospective, not real-time predictions.

Before proposing an additional index dimension:

1. Freeze a source- and time-stratified sample, the rubric and evaluation split before reading model outputs. The provided source-balanced pilot is an audit sample, not a prevalence estimate.
2. Obtain independent labels from at least two annotators, blinded to model answers. Record disagreement and adjudication instead of forcing unclear items into a class.
3. Use a development split to refine the rubric; evaluate once on a held-out, preferably later-period split. Keep reports of the same event within one split.
4. Compare to keyword rules. Report per-class precision/recall, macro-F1, abstention coverage and error at that coverage, with source-level breakdowns. Report Brier score and reliability plots for probabilistic classes. For specificity, report ordinal agreement and absolute error. Evaluate calibration against human labels, not the model's own confidence.
5. Test repeated runs, headline paraphrases and another pinned model. Keep raw disagreements and failures. Label historical model judgments as retrospective because model training may include later events.
6. Only then propose a versioned semantic series with a sufficiently covered reference window. Publish it alongside the baseline before considering a combined score. Missing semantic coverage is missing data, never zero activity.

The runnable implementation and fuller protocol are in `scripts/semantic-pilot.mjs`, `scripts/semantic-corpus.mjs` and `docs/semantic-pilot.md` in the repository.

## References

- [OECD / EU / JRC (2008), Handbook on Constructing Composite Indicators](https://doi.org/10.1787/9789264043466-en): methodological background for documenting choices and checking sensitivity.
- [Zheng et al. (2023), Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685): evidence of judge-model biases in a different evaluation domain; motivation to validate on this corpus, not evidence that this news rubric works.
- [TypeSafe: Score](https://docs.typesafe.ai/primitives/score), [Confidence](https://docs.typesafe.ai/confidence) and [HTTP API](https://docs.typesafe.ai/api): provider documentation for the candidate implementation. Output-type guarantees do not establish semantic accuracy.

# AI FOMO Index: method record

The canonical narrative and exact equations are in
[`src/content/methodology.md`](../src/content/methodology.md), rendered at `/methodology`.
The implementation is [`src/lib/fomo-index.ts`](../src/lib/fomo-index.ts).

## Version 1.1.0

Widens the corpus beyond language models. Image, video and audio labs
(Stability AI, Midjourney, Runway research, Black Forest Labs, Pika, Suno),
world-model labs (World Labs, Wayve) and robotics companies (Figure, Boston
Dynamics, Agility Robotics) are crawled; those with a complete archive are
backfilled to 2022-10-01 and the rest count from first sight. The lab-activity
proxy adds the labs that publish their own models and matches *media* and
*robotics* titles as well as *models*, *products* and *agents*. Topic and entity
keywords learn model names that don't say "image" or "video" (FLUX, Gen-4.5,
Kling, Seedance…). Weights, windows, the curve and band boundaries are
unchanged. Compare `npm run backtest` at this commit and the previous one to see
the effect on history.

## Version 1.0.0

This is the first explicitly versioned baseline. Its arithmetic preserves the
initial index; the research revision changes interpretation and descriptive
labels, not numerical results. Existing machine-readable band IDs are retained.

This is an exploratory composite of activity in selected AI-news sources. It is
not an index of capability, sentiment, human FOMO or real-world importance.
Single-signal score-to-ratio conversions must not be applied to the composite.

## Historical reconstruction

Run `npm ci && npm run backtest` to print the distribution, band shares and
high-scoring windows for the checked-out dataset. The command records the method
version, observation date and input fingerprints. Save the output with the
repository commit when publishing results.

History uses retrospectively collected records and point totals. Identifying
familiar events among peaks is an exploratory face-validity check, not independent
validation. Method choices were informed by this same history. The first few
historical topic-spike comparisons have limited source eligibility.

## Current-snapshot sensitivity

`/research.json` and the research overview include equal weights, removal of each
signal with renormalized weights, and removal of each eligible source from all
windows. They include the published baseline in their minimum–maximum range.
This is a local specification range, not a confidence interval. It does not vary
all choices or establish population representativeness.

## Next work

See [the semantic pilot](semantic-pilot.md) and [contribution guide](../CONTRIBUTING.md).
Independent annotation, event-level deduplication, source audits, full-history
sensitivity and prospective validation remain open work. Report negative results.

# Contributing to the research

AI FOMO Index is an exploratory study. Useful contributions improve what can be
measured, reproduced or falsified. Negative results and disagreements are welcome.

## Starting points

- Audit a sample for irrelevant records, false keyword matches and missed sources.
- Document source coverage gaps and effects of publisher frequency changes.
- Annotate the semantic pilot independently, using its frozen rubric.
- Group multiple reports of one event and compare event-based to URL-based counts.
- Test sensitivity across the full history, including windows and curve exponents.
- Propose a prospective evaluation without selecting only recognizable peaks.

## A reproducible proposal

State the question and measured construct. Record the repository commit, dataset
hash, observation date, method/rubric version and exact commands. Separate observed
results from interpretations. Report all preselected comparisons, including
failures, missingness and source-level effects. Do not present sensitivity ranges
as confidence intervals or model confidence as measured accuracy.

Keep the baseline available. Changes to collection, classification, weights or
aggregation require a versioned comparison and a note on historical revisions.
Do not silently rewrite historical data to make an event rank higher. New sources
need justified coverage boundaries, not just an RSS URL.

For model work, retain exact inputs, pinned model IDs and distributions. Human
labels should be independent of model answers. Never commit credentials or raw
private material. Publish reviewed experiment outputs in a named release rather
than committing local `experiments/runs/` directories wholesale.

## Checks

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run backtest
npm run build
```

Inspect desktop/mobile pages and the generated report if their presentation
changes. No model API call is required for the baseline checks.

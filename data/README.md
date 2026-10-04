# AI FOMO Index dataset

The open dataset of AI developments, produced by [`/pipeline`](../pipeline) and
served by the website. Records are generated; points, coverage and historical reconstructions can be revised. Pin a repository commit when reproducing a result.

## Layout

```
data/
├── news/YYYY/MM/DD/<id>-<slug>.md   one markdown file per item (frontmatter + summary)
├── index.json                       newest-first machine-readable index of every item
├── seen.json                        dedup ledger: item id -> first-seen timestamp
└── coverage.json                    declared per-source collection boundaries (not completeness guarantees)
```

- **`id`** is a 12-char hash of the canonical URL (http treated as https,
  tracking params stripped), so the same article from different links collapses
  to one entry.
- **`points`** is the story's Hacker News score, when its link made Hacker News.
- **`index.json`** is what apps and the website should read. The markdown files
  are the human-readable, forkable source of truth.

## License

The dataset is licensed **CC BY 4.0** — see [LICENSE](./LICENSE). The pipeline
code is MIT. Items link to third-party sources and quote only their headlines.
Article bodies are never reproduced, and no descriptions are generated.
Headlines stay the property of their publishers. Publishers can ask to be left
out; see "For publishers" in the main README.

## Interpretation

`importance` mixes legacy model and heuristic scores; annotator/model provenance
was not stored per row. Do not treat it as a human gold label. Headline keywords
are used for current topic classification, independently of stored tags. Multiple
URLs may describe one event. Historical HN scores are retrospectively collected;
live scores are refreshed for three days and are not guaranteed final.

The observation timestamp is the latest first-seen timestamp in `seen.json`, not
a crawler heartbeat. The research snapshot hashes these files without modifying
them. The new semantic pilot is separate and does not overwrite legacy annotations.

## Known coverage gaps

`coverage.json` declares when each source's collection starts. It is not a
completeness guarantee: the historical part was backfilled from whatever archive
each source exposes, and some archives are visibly thinner in their early years.
Records per year for sources declared from 2022-10-01 (2022 is one quarter, 2026
runs to early October):

| Source | 2022 | 2023 | 2024 | 2025 | 2026 |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai | 7 | 65 | 162 | 333 | 464 |
| anthropic | 0 | 25 | 37 | 97 | 101 |
| deepmind | 11 | 26 | 27 | 49 | 77 |
| huggingface | 32 | 153 | 190 | 206 | 179 |
| mistral | 0 | 4 | 19 | 32 | 28 |
| stability | 6 | 44 | 40 | 20 | 5 |
| runway | 1 | 5 | 7 | 6 | 5 |
| bfl | 0 | 0 | 4 | 11 | 13 |
| worldlabs | 0 | 0 | 3 | 5 | 10 |
| wayve | 2 | 9 | 7 | 10 | 9 |
| bostondynamics | 2 | 13 | 23 | 13 | 21 |
| agility | 1 | 5 | 19 | 12 | 18 |

Mistral published its first post in 2023, and Black Forest Labs and World Labs
were founded in 2024, so their early zeros are expected. Runway counts its
research pages only, the part of its site the live crawl can read. Stability
AI's decline is its own: it publishes far less than in 2023. Midjourney (updates
site since 2024), Figure and Pika (blogs started after the companies did) and
Suno (no archive) count from when the pipeline first saw them. The
others published more than these counts show in 2022–2024, and DeepMind has only
2 records in Q1 2025. Growth in these rows mixes real publishing growth with
archive depth, which matters most for the long-run level. Audits that recover
missing posts are welcome; see CONTRIBUTING.md.

## Revisions

- **2026-10-04 — image, video, audio, world-model and robotics sources (method
  v1.1.0).** Stability AI, Runway research, Black Forest Labs, World Labs, Wayve,
  Boston Dynamics and Agility Robotics were backfilled to 2022-10-01; Midjourney,
  Figure and Pika archives were added without a coverage claim. 469 stories were
  added and 10 lab posts already stored via Hacker News moved to their lab.

- **2026-10-03 — pipeline bug fixes applied to existing rows.** Two DeepMind
  titles cut at an apostrophe were restored, HTML entities (`&apos;`, `&#34;`,
  `&#43;`) were decoded in 26 titles, importance was raised to 3 on 23 rows with
  exactly 200 points (the documented 200+ rule), 41 rows found via `http://`
  links moved to the id of their `https://` URL, and 7 duplicates were removed
  (3 `http`/`https` or path-case twins of one URL, 4 lab posts republished under
  a new URL on the same day). Removed ids stay in `seen.json` so they are not
  re-added. Index readings that include these rows can change slightly.

### Jev headline annotations

`semantic/annotations.jsonl` is an append-only annotation journal with the source
record ID, exact-request SHA-256, rubric hash, model/version, timestamps and raw
validated Jev response. Join to `index.json` by ID and select the matching request
hash; older versions remain in the journal. `semantic/summary.json` reports current
coverage and model label counts. `semantic/failures.jsonl`, when present, records
failed attempts separately; they are not valid annotations. These labels carry
zero weight in the published deterministic index. See `docs/semantic-pilot.md` for
execution, secret configuration and validation limitations.

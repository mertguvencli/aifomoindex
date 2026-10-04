---
license: cc-by-4.0
language:
  - en
pretty_name: AI FOMO Index
size_categories:
  - 10K<n<100K
task_categories:
  - text-classification
tags:
  - ai-news
  - news
  - time-series
  - hacker-news
  - llm
configs:
  - config_name: items
    data_files: items.parquet
    default: true
  - config_name: annotations
    data_files: annotations.parquet
---

# AI FOMO Index

An open corpus of AI-news items from AI lab blogs, publishers and Hacker News, collected for [AI FOMO Index](https://aifomoindex.com): an open research project that tracks the changing pace of the AI information environment.

As of {{SYNCED}} the corpus holds **{{ITEMS}} items** published between {{FIRST}} and {{LAST}}. It is synced daily from the [GitHub repository](https://github.com/mertguvencli/aifomoindex), and each GitHub release is archived on Zenodo: [10.5281/zenodo.23144696](https://doi.org/10.5281/zenodo.23144696).

- **Live index and research overview:** [aifomoindex.com](https://aifomoindex.com)
- **Method:** [aifomoindex.com/methodology](https://aifomoindex.com/methodology)
- **Pipeline and source configuration:** [GitHub](https://github.com/mertguvencli/aifomoindex)

> The index describes changes in a selected AI-news corpus. It does not measure technological progress, human anxiety, personal relevance or real-world impact. No independent validation or peer-review status is claimed.

## Usage

```python
from datasets import load_dataset

items = load_dataset("mertguvencli/aifomoindex", "items", split="train")
annotations = load_dataset("mertguvencli/aifomoindex", "annotations", split="train")
```

## Configs

### `items` (default)

One row per news item. Duplicate links to the same article collapse to one item.

| Column | Description |
| --- | --- |
| `id` | 12-character hash of the canonical URL (http treated as https, tracking parameters removed) |
| `title` | Headline as published by the source |
| `url` | Link to the original article |
| `source` | Source key, as configured in the pipeline |
| `published_at` | Publication time (UTC) |
| `tags` | Topic tags assigned by the pipeline |
| `importance` | Pipeline importance level |
| `summary` | Short summary; for most items this is the headline |
| `points` | Hacker News score, when the link made Hacker News |
| `path` | Path of the item's markdown file in the GitHub repository |

### `annotations`

{{ANNOTATIONS}} rows: the latest annotation per item and protocol from Jev, a third-party model. They are research records with no human accuracy benchmark, and they carry **zero weight** in the index.

- `jev-headlines-v1`: annotated from the headline only.
- `jev-excerpts-v2`: annotated from the headline plus a short source excerpt, where one could be fetched.

Columns: `id` (joins to `items.id`), `protocol`, `model`, `completed_at`, `relevance` and `concrete_change` (the chosen label), `specificity` (score from 0 to 2), and a `*_confidence` for each answer. Full answer distributions, input hashes and token usage are in the GitHub repository under `data/semantic/`.

## Caveats

- Records are generated. Points, coverage and historical reconstructions can be revised between versions. Pin a Zenodo version or a repository commit when reproducing a result.
- Coverage follows the configured sources and their declared collection boundaries. It is not a complete record of AI news.

## License and attribution

CC BY 4.0. Credit "AI FOMO Index" with a link to [aifomoindex.com](https://aifomoindex.com).

Each item links to a third-party source and quotes only its headline. Headlines, articles and trademarks remain the property of their owners and are not licensed here. The license covers what AI FOMO Index adds: the compilation, its structure, tags, scores and other metadata.

## Citation

```bibtex
@dataset{guvencli_aifomoindex,
  author    = {Guvencli, Mert},
  title     = {AI FOMO Index: an open dataset and index of AI-news activity},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.23144696},
  url       = {https://doi.org/10.5281/zenodo.23144696}
}
```

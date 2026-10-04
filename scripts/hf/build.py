"""Build the Hugging Face copy of the dataset into an output folder.

  python scripts/hf/build.py <out-dir>

Writes items.parquet (data/index.json), annotations.parquet (the latest Jev
annotation per protocol for each current item, flattened) and README.md (the dataset card,
filled from card.md). The markdown files under data/news are not copied: every
field they carry is already in index.json.
"""

import json
import sys
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
ANNOTATIONS = [DATA / "semantic" / "annotations.jsonl", DATA / "semantic" / "v2" / "annotations.jsonl"]

ITEMS_SCHEMA = pa.schema([
    ("id", pa.string()),
    ("title", pa.string()),
    ("url", pa.string()),
    ("source", pa.string()),
    ("published_at", pa.timestamp("ms", tz="UTC")),
    ("tags", pa.list_(pa.string())),
    ("importance", pa.int8()),
    ("summary", pa.string()),
    ("points", pa.int32()),
    ("path", pa.string()),
])

ANNOTATIONS_SCHEMA = pa.schema([
    ("id", pa.string()),
    ("protocol", pa.string()),
    ("model", pa.string()),
    ("completed_at", pa.timestamp("ms", tz="UTC")),
    ("relevance", pa.string()),
    ("relevance_confidence", pa.float64()),
    ("concrete_change", pa.string()),
    ("concrete_change_confidence", pa.float64()),
    ("specificity", pa.float64()),
    ("specificity_confidence", pa.float64()),
])


def ts(value):
    """ISO 8601, or the RFC 2822 dates some feeds publish."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return parsedate_to_datetime(value)


def items():
    rows = json.loads((DATA / "index.json").read_text())
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "url": r["url"],
            "source": r["source"],
            "published_at": ts(r.get("publishedAt")),
            "tags": r.get("tags") or [],
            "importance": r.get("importance"),
            "summary": r.get("summary"),
            "points": r.get("points"),
            "path": f"data/{r['path']}" if r.get("path") else None,
        }
        for r in rows
    ]


def annotations(ids):
    latest = {}
    for path in ANNOTATIONS:
        for line in path.read_text().splitlines():
            if not line.strip():
                continue
            r = json.loads(line)
            answers = (r.get("response") or {}).get("answers")
            if not answers or r["id"] not in ids:
                continue
            key = (r["protocol"], r["id"])
            if key in latest and latest[key]["completedAt"] >= r["completedAt"]:
                continue
            latest[key] = r
    rows = []
    for r in latest.values():
        a = r["response"]["answers"]
        rows.append({
            "id": r["id"],
            "protocol": r["protocol"],
            "model": r["response"].get("model"),
            "completed_at": ts(r["completedAt"]),
            "relevance": a["relevance"].get("choice"),
            "relevance_confidence": a["relevance"].get("confidence"),
            "concrete_change": a["concreteChange"].get("choice"),
            "concrete_change_confidence": a["concreteChange"].get("confidence"),
            "specificity": a["specificity"].get("score"),
            "specificity_confidence": a["specificity"].get("confidence"),
        })
    return sorted(rows, key=lambda r: (r["protocol"], r["id"]))


def main(out):
    out.mkdir(parents=True, exist_ok=True)
    item_rows = items()
    annotation_rows = annotations({r["id"] for r in item_rows})
    pq.write_table(pa.Table.from_pylist(item_rows, ITEMS_SCHEMA), out / "items.parquet")
    pq.write_table(pa.Table.from_pylist(annotation_rows, ANNOTATIONS_SCHEMA), out / "annotations.parquet")

    dates = [r["published_at"] for r in item_rows if r["published_at"]]
    card = (Path(__file__).parent / "card.md").read_text()
    for key, value in {
        "ITEMS": f"{len(item_rows):,}",
        "ANNOTATIONS": f"{len(annotation_rows):,}",
        "FIRST": min(dates).date().isoformat(),
        "LAST": max(dates).date().isoformat(),
        "SYNCED": datetime.now(timezone.utc).date().isoformat(),
    }.items():
        card = card.replace("{{" + key + "}}", value)
    (out / "README.md").write_text(card)
    print(f"{len(item_rows)} items, {len(annotation_rows)} annotations -> {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))

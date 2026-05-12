"""Build author metadata JSON from the reviewed author metadata CSV."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build authors.json from data/author_metadata.csv.")
    parser.add_argument("--input-csv", type=Path, default=Path("data/author_metadata.csv"))
    parser.add_argument("--output-json", type=Path, default=Path("data/authors.json"))
    parser.add_argument("--site-output-json", type=Path, default=Path("site/data/authors.json"))
    return parser.parse_args()


def parse_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "y"}


def parse_tags(value: str) -> list[str]:
    return [tag.strip() for tag in value.split(";") if tag.strip()]


def read_rows(input_csv: Path) -> list[dict[str, str]]:
    with input_csv.open("r", newline="", encoding="utf-8-sig") as csv_file:
        return list(csv.DictReader(csv_file))


def row_to_author(row: dict[str, str]) -> dict[str, object]:
    quote_count_text = row.get("quote_count", "0").strip()
    return {
        "author_key": row.get("author_key", "").strip(),
        "display_name": row.get("display_name", "").strip(),
        "full_author": row.get("full_author", "").strip(),
        "quote_count": int(quote_count_text or 0),
        "author_type": row.get("author_type", "").strip(),
        "source_title": row.get("source_title", "").strip(),
        "source_creator": row.get("source_creator", "").strip(),
        "fof_role": row.get("fof_role", "").strip(),
        "short_note": row.get("short_note", "").strip(),
        "tags": parse_tags(row.get("tags", "")),
        "verified": parse_bool(row.get("verified", "")),
        "needs_research": parse_bool(row.get("needs_research", "")),
        "research_notes": row.get("research_notes", "").strip(),
    }


def write_json(authors: list[dict[str, object]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as json_file:
        json.dump(authors, json_file, indent=2, ensure_ascii=False)
        json_file.write("\n")


def main() -> None:
    args = parse_args()

    if not args.input_csv.exists():
        raise SystemExit(f"Author metadata CSV not found: {args.input_csv}")

    rows = read_rows(args.input_csv)
    authors = [row_to_author(row) for row in rows]
    authors.sort(key=lambda author: str(author["display_name"]).lower())

    write_json(authors, args.output_json)
    write_json(authors, args.site_output_json)

    print(f"Read {len(authors)} author row(s) from {args.input_csv}")
    print(f"Wrote {args.output_json}")
    print(f"Wrote {args.site_output_json}")


if __name__ == "__main__":
    main()

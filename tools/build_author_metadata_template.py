"""Build a manual author metadata CSV template from the quote JSON."""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path


CSV_FIELDS = [
    "author_key",
    "display_name",
    "full_author",
    "quote_count",
    "author_type",
    "source_title",
    "source_creator",
    "fof_role",
    "short_note",
    "tags",
    "verified",
    "needs_research",
    "research_notes",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create data/author_metadata.csv from site/data/quotes.json.")
    parser.add_argument("--quotes-json", type=Path, default=Path("site/data/quotes.json"))
    parser.add_argument("--output-csv", type=Path, default=Path("data/author_metadata.csv"))
    parser.add_argument("--force", action="store_true", help="Overwrite the output CSV if it already exists.")
    return parser.parse_args()


def slugify_author(author: str) -> str:
    slug = author.lower()
    slug = slug.replace("&", " and ")
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-") or "unknown-author"


def make_unique_keys(authors: list[str]) -> dict[str, str]:
    keys: dict[str, str] = {}
    used: Counter[str] = Counter()

    for author in authors:
        base_key = slugify_author(author)
        used[base_key] += 1
        if used[base_key] == 1:
            keys[author] = base_key
        else:
            keys[author] = f"{base_key}-{used[base_key]}"

    return keys


def get_display_name(author: str) -> str:
    display_name = re.sub(r"\([^)]*\)", "", author).strip()
    display_name = display_name.split(",", 1)[0].strip()
    return display_name or author.strip()


def infer_fof_role(author: str) -> str:
    """Infer only role/team text already present in the author string."""
    parts = [part.strip() for part in author.split(",")]
    if len(parts) <= 1:
        return ""
    return ", ".join(parts[1:]).strip()


def read_quotes(quotes_json: Path) -> list[dict[str, object]]:
    with quotes_json.open("r", encoding="utf-8") as json_file:
        return json.load(json_file)


def build_rows(quotes: list[dict[str, object]]) -> list[dict[str, str]]:
    author_counts = Counter(str(quote.get("author", "")).strip() for quote in quotes)
    author_counts.pop("", None)

    authors = sorted(author_counts.keys(), key=get_display_name)
    author_keys = make_unique_keys(authors)

    rows: list[dict[str, str]] = []
    for author in authors:
        rows.append(
            {
                "author_key": author_keys[author],
                "display_name": get_display_name(author),
                "full_author": author,
                "quote_count": str(author_counts[author]),
                "author_type": "",
                "source_title": "",
                "source_creator": "",
                "fof_role": infer_fof_role(author),
                "short_note": "",
                "tags": "",
                "verified": "false",
                "needs_research": "true",
                "research_notes": "",
            }
        )

    return rows


def write_csv(rows: list[dict[str, str]], output_csv: Path) -> None:
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    args = parse_args()

    if not args.quotes_json.exists():
        raise SystemExit(f"Quotes JSON not found: {args.quotes_json}")

    if args.output_csv.exists() and not args.force:
        raise SystemExit(f"{args.output_csv} already exists. Use --force to overwrite it.")

    quotes = read_quotes(args.quotes_json)
    rows = build_rows(quotes)
    write_csv(rows, args.output_csv)

    print(f"Read {len(quotes)} quote(s) from {args.quotes_json}")
    print(f"Wrote {len(rows)} author row(s) to {args.output_csv}")
    print("Metadata fields are intentionally blank where manual review is needed.")


if __name__ == "__main__":
    main()

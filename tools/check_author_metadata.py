"""Check author metadata against the current quote JSON."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate data/author_metadata.csv against site/data/quotes.json.")
    parser.add_argument("--quotes-json", type=Path, default=Path("site/data/quotes.json"))
    parser.add_argument("--metadata-csv", type=Path, default=Path("data/author_metadata.csv"))
    return parser.parse_args()


def parse_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "y"}


def read_quotes(quotes_json: Path) -> list[dict[str, object]]:
    with quotes_json.open("r", encoding="utf-8") as json_file:
        return json.load(json_file)


def read_metadata(metadata_csv: Path) -> list[dict[str, str]]:
    with metadata_csv.open("r", newline="", encoding="utf-8-sig") as csv_file:
        return list(csv.DictReader(csv_file))


def print_section(title: str, items: list[str]) -> None:
    if not items:
        print(f"{title}: none")
        return

    print(f"{title}:")
    for item in items:
        print(f"  - {item}")


def main() -> None:
    args = parse_args()

    if not args.quotes_json.exists():
        raise SystemExit(f"Quotes JSON not found: {args.quotes_json}")
    if not args.metadata_csv.exists():
        raise SystemExit(f"Author metadata CSV not found: {args.metadata_csv}")

    quotes = read_quotes(args.quotes_json)
    rows = read_metadata(args.metadata_csv)

    quote_counts = Counter(str(quote.get("author", "")).strip() for quote in quotes)
    quote_counts.pop("", None)

    metadata_authors = [row.get("full_author", "").strip() for row in rows]
    metadata_author_set = set(author for author in metadata_authors if author)
    quote_author_set = set(quote_counts.keys())

    key_counts = Counter(row.get("author_key", "").strip() for row in rows)
    key_counts.pop("", None)

    missing_from_metadata = sorted(quote_author_set - metadata_author_set)
    extra_in_metadata = sorted(metadata_author_set - quote_author_set)
    duplicate_keys = sorted(key for key, count in key_counts.items() if count > 1)

    blank_display_names = []
    blank_full_authors = []
    quote_count_mismatches = []
    verified_missing_type = []
    verified_missing_note = []

    for row_number, row in enumerate(rows, start=2):
        display_name = row.get("display_name", "").strip()
        full_author = row.get("full_author", "").strip()
        quote_count_text = row.get("quote_count", "").strip()
        verified = parse_bool(row.get("verified", ""))

        if not display_name:
            blank_display_names.append(f"row {row_number}")
        if not full_author:
            blank_full_authors.append(f"row {row_number}")

        if full_author in quote_counts:
            try:
                metadata_count = int(quote_count_text or 0)
            except ValueError:
                metadata_count = -1
            if metadata_count != quote_counts[full_author]:
                quote_count_mismatches.append(
                    f"{full_author}: metadata {quote_count_text or '[blank]'}, quotes {quote_counts[full_author]}"
                )

        if verified and not row.get("author_type", "").strip():
            verified_missing_type.append(f"{full_author or f'row {row_number}'}")
        if verified and not row.get("short_note", "").strip():
            verified_missing_note.append(f"{full_author or f'row {row_number}'}")

    print("Author metadata check")
    print("=====================")
    print(f"Quote authors: {len(quote_author_set)}")
    print(f"Metadata rows: {len(rows)}")
    print()
    print_section("Authors in quotes.json missing from author_metadata.csv", missing_from_metadata)
    print_section("Authors in metadata not present in quotes.json", extra_in_metadata)
    print_section("Duplicate author_key values", duplicate_keys)
    print_section("Blank display_name", blank_display_names)
    print_section("Blank full_author", blank_full_authors)
    print_section("Quote count mismatches", quote_count_mismatches)
    print_section("Verified rows with blank author_type", verified_missing_type)
    print_section("Verified rows with blank short_note", verified_missing_note)


if __name__ == "__main__":
    main()

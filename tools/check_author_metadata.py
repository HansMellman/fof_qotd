"""Check author metadata against the current quote JSON."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path


BOOLEAN_VALUES = {"true", "false", "True", "False"}

KNOWN_AUTHOR_TYPES = {
    "",
    "real_football_person",
    "real_historical_person",
    "literary_character",
    "film_or_pop_culture_character",
    "fof_universe_fictional",
    "developer",
    "writer",
    "philosopher",
    "musician",
    "unknown",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate data/author_metadata.csv against site/data/quotes.json.")
    parser.add_argument("--quotes-json", type=Path, default=Path("site/data/quotes.json"))
    parser.add_argument("--metadata-csv", type=Path, default=Path("data/author_metadata.csv"))
    return parser.parse_args()


def parse_strict_bool(value: str) -> bool | None:
    stripped = value.strip()
    if stripped not in BOOLEAN_VALUES:
        return None
    return stripped.lower() == "true"


def read_quotes(quotes_json: Path) -> list[dict[str, object]]:
    with quotes_json.open("r", encoding="utf-8") as json_file:
        return json.load(json_file)


def read_metadata(metadata_csv: Path) -> list[dict[str, object]]:
    with metadata_csv.open("r", newline="", encoding="utf-8-sig") as csv_file:
        return list(csv.DictReader(csv_file))


def print_section(title: str, items: list[str]) -> None:
    if not items:
        print(f"{title}: none")
        return

    print(f"{title}:")
    for item in items:
        print(f"  - {item}")


def has_unmatched_edge_quote(value: str) -> bool:
    stripped = value.strip()
    if not stripped:
        return False
    starts_with_quote = stripped.startswith(('"', "'"))
    ends_with_quote = stripped.endswith(('"', "'"))
    return starts_with_quote != ends_with_quote


def describe_row(row_number: int, row: dict[str, object]) -> str:
    full_author = str(row.get("full_author", "")).strip()
    author_key = str(row.get("author_key", "")).strip()
    if full_author:
        return f"row {row_number} ({full_author})"
    if author_key:
        return f"row {row_number} ({author_key})"
    return f"row {row_number}"


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

    errors: list[str] = []
    warnings: list[str] = []

    for row_number, row in enumerate(rows, start=2):
        row_label = describe_row(row_number, row)
        display_name = str(row.get("display_name", "")).strip()
        full_author = str(row.get("full_author", "")).strip()
        quote_count_text = str(row.get("quote_count", "")).strip()
        author_type = str(row.get("author_type", "")).strip()
        short_note = str(row.get("short_note", "")).strip()
        tags = str(row.get("tags", "")).strip()
        verified_text = str(row.get("verified", "")).strip()
        needs_research_text = str(row.get("needs_research", "")).strip()
        verified = parse_strict_bool(verified_text)
        needs_research = parse_strict_bool(needs_research_text)

        if None in row:
            extra_values = row.get(None)
            errors.append(f"{row_label}: malformed CSV row has extra unnamed field(s): {extra_values}")

        if not display_name:
            errors.append(f"{row_label}: blank display_name")
        if not full_author:
            errors.append(f"{row_label}: blank full_author")

        if full_author in quote_counts:
            try:
                metadata_count = int(quote_count_text or 0)
            except ValueError:
                metadata_count = -1
            if metadata_count != quote_counts[full_author]:
                errors.append(
                    f"{full_author}: metadata {quote_count_text or '[blank]'}, quotes {quote_counts[full_author]}"
                )

        if verified is None:
            errors.append(f"{row_label}: invalid verified value {verified_text!r}")
        if needs_research is None:
            errors.append(f"{row_label}: invalid needs_research value {needs_research_text!r}")

        if author_type not in KNOWN_AUTHOR_TYPES:
            errors.append(f"{row_label}: unexpected author_type {author_type!r}")

        if verified is True and not author_type:
            errors.append(f"{row_label}: verified=true but author_type is blank")
        if verified is True and not short_note:
            errors.append(f"{row_label}: verified=true but short_note is blank")
        if verified is True and needs_research is True:
            warnings.append(f"{row_label}: verified=true but needs_research is also true")

        if tags:
            if "," in tags:
                warnings.append(f"{row_label}: tags contains a comma; tags should be semicolon-separated")
            if tags.startswith(('"', "'")) or tags.endswith(('"', "'")):
                warnings.append(f"{row_label}: tags begins or ends with a quote character")

        if short_note:
            if has_unmatched_edge_quote(short_note):
                warnings.append(f"{row_label}: short_note starts or ends with an unmatched quote")
            if short_note.startswith(('"', "'")) and not short_note.endswith((".", "!", "?", '"', "'")):
                warnings.append(f"{row_label}: short_note may be truncated")
            if verified is True and len(short_note) < 20:
                warnings.append(f"{row_label}: verified row has a very short short_note")

    for author in missing_from_metadata:
        errors.append(f"author missing from metadata: {author}")
    for author in extra_in_metadata:
        errors.append(f"metadata author not present in quotes.json: {author}")
    for key in duplicate_keys:
        errors.append(f"duplicate author_key: {key}")

    print("Author metadata check")
    print("=====================")
    print(f"Quote authors: {len(quote_author_set)}")
    print(f"Metadata rows: {len(rows)}")
    print()
    print_section("Errors", errors)
    print_section("Warnings", warnings)
    print()
    print("Summary")
    print("-------")
    print(f"Total errors: {len(errors)}")
    print(f"Total warnings: {len(warnings)}")

    if errors:
        print("Metadata validation failed.")
        raise SystemExit(1)
    if warnings:
        print("Metadata validation passed with warnings.")
        return

    print("Metadata validation passed cleanly.")


if __name__ == "__main__":
    main()

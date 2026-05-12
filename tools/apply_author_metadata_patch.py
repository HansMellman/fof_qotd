"""Apply reviewed author metadata updates from a small patch CSV."""

from __future__ import annotations

import argparse
import csv
import shutil
from datetime import datetime
from pathlib import Path


PATCH_FIELDS = [
    "author_key",
    "author_type",
    "source_title",
    "source_creator",
    "short_note",
    "tags",
    "verified",
    "needs_research",
    "research_notes",
]

UPDATE_FIELDS = [
    "author_type",
    "source_title",
    "source_creator",
    "short_note",
    "tags",
    "verified",
    "needs_research",
    "research_notes",
]

LOCKED_FIELDS = [
    "author_key",
    "display_name",
    "full_author",
    "quote_count",
    "fof_role",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply data/author_metadata_patch.csv to author_metadata.csv.")
    parser.add_argument("--patch", type=Path, default=Path("data/author_metadata_patch.csv"))
    parser.add_argument("--metadata-csv", type=Path, default=Path("data/author_metadata.csv"))
    return parser.parse_args()


def read_csv(csv_path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with csv_path.open("r", newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        return list(reader), list(reader.fieldnames or [])


def validate_patch_columns(fieldnames: list[str]) -> None:
    missing = [field for field in PATCH_FIELDS if field not in fieldnames]
    if missing:
        missing_text = ", ".join(missing)
        raise SystemExit(f"Patch CSV is missing required column(s): {missing_text}")


def make_backup(metadata_csv: Path) -> Path:
    backup_path = metadata_csv.with_name("author_metadata_before_patch.csv")
    if backup_path.exists():
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = metadata_csv.with_name(f"author_metadata_before_patch_{timestamp}.csv")

    shutil.copy2(metadata_csv, backup_path)
    return backup_path


def write_metadata(rows: list[dict[str, str]], fieldnames: list[str], metadata_csv: Path) -> None:
    with metadata_csv.open("w", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def apply_patch_rows(
    metadata_rows: list[dict[str, str]],
    patch_rows: list[dict[str, str]],
) -> tuple[int, list[str], dict[str, list[str]]]:
    metadata_by_key = {row.get("author_key", "").strip(): row for row in metadata_rows}
    unknown_keys: list[str] = []
    changed_fields_by_author: dict[str, list[str]] = {}
    rows_updated = 0

    for patch_row in patch_rows:
        author_key = patch_row.get("author_key", "").strip()
        if not author_key:
            unknown_keys.append("[blank author_key]")
            continue

        metadata_row = metadata_by_key.get(author_key)
        if metadata_row is None:
            unknown_keys.append(author_key)
            continue

        changed_fields: list[str] = []
        for field in UPDATE_FIELDS:
            new_value = patch_row.get(field, "")
            old_value = metadata_row.get(field, "")
            if new_value != old_value:
                metadata_row[field] = new_value
                changed_fields.append(field)

        if changed_fields:
            rows_updated += 1
            display_name = metadata_row.get("display_name", "").strip() or author_key
            changed_fields_by_author[display_name] = changed_fields

    return rows_updated, unknown_keys, changed_fields_by_author


def main() -> None:
    args = parse_args()

    if not args.patch.exists():
        raise SystemExit(f"Patch CSV not found: {args.patch}")
    if not args.metadata_csv.exists():
        raise SystemExit(f"Author metadata CSV not found: {args.metadata_csv}")

    metadata_rows, metadata_fields = read_csv(args.metadata_csv)
    patch_rows, patch_fields = read_csv(args.patch)
    validate_patch_columns(patch_fields)

    backup_path = make_backup(args.metadata_csv)
    rows_updated, unknown_keys, changed_fields_by_author = apply_patch_rows(metadata_rows, patch_rows)
    write_metadata(metadata_rows, metadata_fields, args.metadata_csv)

    print("Author metadata patch report")
    print("============================")
    print(f"Patch CSV: {args.patch}")
    print(f"Metadata CSV: {args.metadata_csv}")
    print(f"Backup created: {backup_path}")
    print(f"Patch rows read: {len(patch_rows)}")
    print(f"Rows updated: {rows_updated}")
    print()

    if unknown_keys:
        print("Unknown author_key values skipped:")
        for author_key in unknown_keys:
            print(f"  - {author_key}")
    else:
        print("Unknown author_key values skipped: none")

    print()
    if changed_fields_by_author:
        print("Fields changed per author:")
        for display_name, changed_fields in changed_fields_by_author.items():
            print(f"  - {display_name}: {', '.join(changed_fields)}")
    else:
        print("Fields changed per author: none")

    print()
    print("Locked fields were not modified:")
    print(f"  {', '.join(LOCKED_FIELDS)}")


if __name__ == "__main__":
    main()

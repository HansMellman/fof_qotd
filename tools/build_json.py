"""Build JSON data files for the static quote archive site."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build quotes.json from the reviewed CSV archive.")
    parser.add_argument("--input-csv", type=Path, default=Path("data/quotes_clean.csv"))
    parser.add_argument("--fallback-csv", type=Path, default=Path("data/quotes_raw.csv"))
    parser.add_argument("--output-json", type=Path, default=Path("data/quotes.json"))
    parser.add_argument("--site-output-json", type=Path, default=Path("site/data/quotes.json"))
    return parser.parse_args()


def parse_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "y"}


def read_csv(csv_path: Path) -> list[dict[str, str]]:
    with csv_path.open("r", newline="", encoding="utf-8-sig") as csv_file:
        return list(csv.DictReader(csv_file))


def row_to_quote(row: dict[str, str]) -> dict[str, object]:
    return {
        "id": row.get("id", "").strip(),
        "date_key": row.get("date_key", "").strip(),
        "date_label": row.get("date_label", "").strip(),
        "month_number": int(row.get("month_number", "0") or 0),
        "month_name": row.get("month_name", "").strip(),
        "day": int(row.get("day", "0") or 0),
        "text": row.get("cleaned_text", "").strip(),
        "author": row.get("author", "").strip(),
        "image_path": row.get("site_image_path", "").strip(),
        "special_type": row.get("special_type", "").strip(),
        "include_in_default_archive": parse_bool(row.get("include_in_default_archive", "")),
        "notes": row.get("notes", "").strip(),
    }


def write_json(quotes: list[dict[str, object]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as json_file:
        json.dump(quotes, json_file, indent=2, ensure_ascii=False)
        json_file.write("\n")


def main() -> None:
    args = parse_args()
    input_csv = args.input_csv

    if not input_csv.exists():
        if not args.fallback_csv.exists():
            raise SystemExit(f"No CSV found. Expected {input_csv} or {args.fallback_csv}.")
        print(f"Warning: {input_csv} was not found. Falling back to {args.fallback_csv}.")
        input_csv = args.fallback_csv

    rows = read_csv(input_csv)
    quotes = [row_to_quote(row) for row in rows]
    quotes.sort(key=lambda quote: (quote["month_number"], quote["day"], quote["id"]))

    write_json(quotes, args.output_json)
    write_json(quotes, args.site_output_json)

    print(f"Read {len(quotes)} quote(s) from {input_csv}")
    print(f"Wrote {args.output_json}")
    print(f"Wrote {args.site_output_json}")


if __name__ == "__main__":
    main()

"""Validate the expected FOF8 Quote of the Day screenshot archive structure."""

from __future__ import annotations

import argparse
import calendar
import re
from collections import Counter
from pathlib import Path


MONTHS = {
    1: ("Jan", "January"),
    2: ("Feb", "February"),
    3: ("Mar", "March"),
    4: ("Apr", "April"),
    5: ("May", "May"),
    6: ("Jun", "June"),
    7: ("Jul", "July"),
    8: ("Aug", "August"),
    9: ("Sep", "September"),
    10: ("Oct", "October"),
    11: ("Nov", "November"),
    12: ("Dec", "December"),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check source_images/ for expected quote screenshots.")
    parser.add_argument("--source-dir", type=Path, default=Path("source_images"))
    return parser.parse_args()


def expected_month_folders() -> list[str]:
    return [f"{month_number:02d}_{abbr}" for month_number, (abbr, _name) in MONTHS.items()]


def parse_png(source_dir: Path, image_path: Path) -> tuple[str, str] | None:
    try:
        month_folder = image_path.parent.relative_to(source_dir).parts[0]
    except (ValueError, IndexError):
        return None

    folder_match = re.fullmatch(r"(?P<number>\d{2})_(?P<abbr>[A-Za-z]{3})", month_folder)
    file_match = re.fullmatch(
        r"(?P<day>\d{2})_(?P<abbr>[A-Za-z]{3})(?P<fake>_FAKE)?\.png",
        image_path.name,
        flags=re.IGNORECASE,
    )
    if folder_match is None or file_match is None:
        return None

    month_number = int(folder_match.group("number"))
    day = int(file_match.group("day"))
    date_key = f"{month_number:02d}-{day:02d}"

    special_type = ""
    if month_number == 2 and day == 29:
        special_type = "leap_day"
    if month_number == 4 and day == 1 and file_match.group("fake"):
        special_type = "fake"

    return date_key, special_type


def expected_normal_date_keys() -> set[str]:
    dates: set[str] = set()
    for month_number in range(1, 13):
        days_in_month = calendar.monthrange(2025, month_number)[1]
        for day in range(1, days_in_month + 1):
            dates.add(f"{month_number:02d}-{day:02d}")
    return dates


def main() -> None:
    args = parse_args()
    source_dir = args.source_dir

    if not source_dir.exists():
        raise SystemExit(f"Source directory not found: {source_dir}")

    expected_folders = expected_month_folders()
    existing_folders = {path.name for path in source_dir.iterdir() if path.is_dir()}
    missing_folders = [folder for folder in expected_folders if folder not in existing_folders]

    png_paths = sorted(source_dir.rglob("*.png"))
    normal_date_keys: list[str] = []
    special_counts = Counter()
    skipped_paths: list[Path] = []

    for image_path in png_paths:
        parsed = parse_png(source_dir, image_path)
        if parsed is None:
            skipped_paths.append(image_path)
            continue

        date_key, special_type = parsed
        if special_type:
            special_counts[special_type] += 1
        else:
            normal_date_keys.append(date_key)

    expected_dates = expected_normal_date_keys()
    normal_counts = Counter(normal_date_keys)
    found_normal_dates = set(normal_date_keys)
    missing_dates = sorted(expected_dates - found_normal_dates)
    duplicate_dates = sorted(date_key for date_key, count in normal_counts.items() if count > 1)

    print("FOF QOTD archive validation")
    print("===========================")
    print(f"Source directory: {source_dir}")
    print(f"Total PNG files: {len(png_paths)}")
    print(f"Normal quote count: {len(normal_date_keys)}")
    print(f"Leap day count: {special_counts['leap_day']}")
    print(f"Fake/special count: {special_counts['fake']}")
    print("Expected normal archive count: 365")
    print()

    if missing_folders:
        print("Missing month folders:")
        for folder in missing_folders:
            print(f"  - {folder}")
    else:
        print("Missing month folders: none")

    if missing_dates:
        print("Missing normal dates:")
        for date_key in missing_dates:
            print(f"  - {date_key}")
    else:
        print("Missing normal dates: none")

    if duplicate_dates:
        print("Duplicate normal date keys:")
        for date_key in duplicate_dates:
            print(f"  - {date_key} ({normal_counts[date_key]} files)")
    else:
        print("Duplicate normal date keys: none")

    if skipped_paths:
        print("Unrecognized PNG paths:")
        for path in skipped_paths:
            print(f"  - {path}")
    else:
        print("Unrecognized PNG paths: none")


if __name__ == "__main__":
    main()

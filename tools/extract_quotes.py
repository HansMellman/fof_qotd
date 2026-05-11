"""Extract quote text from FOF8 Quote of the Day screenshots.

This script scans source_images/, runs OCR on each PNG, writes a reviewable CSV,
and copies the images into site/assets/quotes/ for the static website.
"""

from __future__ import annotations

import argparse
import csv
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter
import pytesseract


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

CSV_FIELDS = [
    "id",
    "date_key",
    "date_label",
    "month_number",
    "month_name",
    "day",
    "filename",
    "source_image_path",
    "site_image_path",
    "raw_ocr_text",
    "cleaned_text",
    "author",
    "special_type",
    "include_in_default_archive",
    "needs_review",
    "notes",
    "ocr_default",
    "ocr_crop_gray",
    "ocr_crop_contrast",
    "ocr_color_mask",
    "ocr_chosen_variant",
]

OCR_VARIANTS = [
    "ocr_default",
    "ocr_crop_gray",
    "ocr_crop_contrast",
    "ocr_color_mask",
]


@dataclass(frozen=True)
class ParsedImage:
    image_path: Path
    month_folder: str
    month_number: int
    month_name: str
    day: int
    special_type: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run OCR on FOF8 Quote of the Day screenshots and write a reviewable CSV."
    )
    parser.add_argument("--source-dir", type=Path, default=Path("source_images"))
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=Path("data/quotes_raw_v2.csv"),
        help="Output CSV path. The default avoids overwriting data/quotes_raw.csv.",
    )
    parser.add_argument("--site-assets-dir", type=Path, default=Path("site/assets/quotes"))
    parser.add_argument("--no-copy-assets", action="store_true")
    parser.add_argument("--include-specials", action="store_true")
    parser.add_argument("--tesseract-cmd", default="")
    parser.add_argument("--contrast", type=float, default=1.8)
    parser.add_argument("--crop-left", type=int, default=10)
    parser.add_argument("--crop-top", type=int, default=35)
    parser.add_argument("--crop-right-margin", type=int, default=10)
    parser.add_argument("--crop-bottom-margin", type=int, default=40)
    parser.add_argument("--upscale", type=int, default=3)
    parser.add_argument(
        "--tesseract-config",
        default="--psm 6",
        help="Extra Tesseract config. The default treats the image as a block of text.",
    )
    return parser.parse_args()


def parse_image_path(image_path: Path, source_dir: Path) -> ParsedImage | None:
    """Return date metadata for a screenshot path, or None if the name is unexpected."""
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
    month_info = MONTHS.get(month_number)
    if month_info is None:
        return None

    expected_abbr, month_name = month_info
    folder_abbr = folder_match.group("abbr").title()
    file_abbr = file_match.group("abbr").title()
    if folder_abbr != expected_abbr or file_abbr != expected_abbr:
        return None

    special_type = ""
    if month_number == 2 and day == 29:
        special_type = "leap_day"
    if month_number == 4 and day == 1 and file_match.group("fake"):
        special_type = "fake"

    return ParsedImage(
        image_path=image_path,
        month_folder=month_folder,
        month_number=month_number,
        month_name=month_name,
        day=day,
        special_type=special_type,
    )


def make_quote_id(parsed: ParsedImage) -> str:
    month_slug = parsed.month_name[:3].lower()
    quote_id = f"{month_slug}-{parsed.day:02d}"
    if parsed.special_type == "fake":
        quote_id += "-fake"
    return quote_id


def is_header_noise(line: str) -> bool:
    normalized = re.sub(r"[^a-z]", "", line.lower())
    if "quoteoftheday" in normalized:
        return True
    return normalized in {"cquoteofthedayc", "oquoteoftheday", "equoteoftheday"}


def is_footer_or_symbol_noise(line: str) -> bool:
    compact = line.strip().lower()
    if compact in {"|", "||", "_", "-", "--", ".", "...", "(ceo", "(ed", "ceo", "ed"}:
        return True
    if re.fullmatch(r"[\W_]{1,6}", compact):
        return True
    if len(compact) <= 4 and re.fullmatch(r"[()|\\/@=\[\]ceodq0\s]+", compact):
        return True
    return False


def clean_ocr_lines(text: str) -> list[str]:
    """Remove obvious UI noise while leaving uncertain quote text for review."""
    lines = [line.strip() for line in text.replace("\r\n", "\n").split("\n")]
    cleaned_lines: list[str] = []

    for line in lines:
        if not line:
            continue
        if is_header_noise(line):
            continue
        if "close window" in line.lower():
            continue
        if is_footer_or_symbol_noise(line):
            continue
        cleaned_lines.append(line)

    while cleaned_lines and is_footer_or_symbol_noise(cleaned_lines[-1]):
        cleaned_lines.pop()

    return cleaned_lines


def clean_ocr_text(text: str) -> str:
    cleaned = " ".join(clean_ocr_lines(text))
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def parse_author_from_lines(lines: list[str]) -> tuple[str, str]:
    """Return quote text and author parsed from a final dash-prefixed line."""
    if not lines:
        return "", ""

    final_line = lines[-1].strip()
    author_match = re.match(r"^[\-–]\s*(?P<author>.+)$", final_line)
    if author_match is None:
        return " ".join(lines).strip(), ""

    author = author_match.group("author").strip()
    quote_lines = lines[:-1]
    quote_text = " ".join(quote_lines).strip()
    quote_text = re.sub(r"\s+", " ", quote_text)
    return quote_text, author


def crop_quote_area(image: Image.Image, args: argparse.Namespace) -> Image.Image:
    width, height = image.size
    left = max(0, args.crop_left)
    top = max(0, args.crop_top)
    right = min(width, width - args.crop_right_margin)
    bottom = min(height, height - args.crop_bottom_margin)
    return image.crop((left, top, right, bottom))


def upscale_image(image: Image.Image, factor: int) -> Image.Image:
    if factor <= 1:
        return image
    width, height = image.size
    return image.resize((width * factor, height * factor), Image.Resampling.LANCZOS)


def make_crop_gray(image: Image.Image, args: argparse.Namespace) -> Image.Image:
    cropped = crop_quote_area(image, args)
    gray = cropped.convert("L")
    return upscale_image(gray, args.upscale)


def make_crop_contrast(image: Image.Image, args: argparse.Namespace) -> Image.Image:
    processed = make_crop_gray(image, args)
    processed = ImageEnhance.Contrast(processed).enhance(args.contrast)
    processed = ImageEnhance.Sharpness(processed).enhance(2.0)
    return processed.filter(ImageFilter.SHARPEN)


def make_color_mask(image: Image.Image, args: argparse.Namespace) -> Image.Image:
    """Keep likely light quote text and red author text; paint everything else white."""
    cropped = crop_quote_area(image, args).convert("RGB")
    output = Image.new("L", cropped.size, 255)
    source_pixels = cropped.load()
    output_pixels = output.load()

    for y in range(cropped.height):
        for x in range(cropped.width):
            red, green, blue = source_pixels[x, y]
            is_light_text = red >= 185 and green >= 185 and blue >= 175
            is_red_text = red >= 130 and red > green * 1.25 and red > blue * 1.15
            if is_light_text or is_red_text:
                output_pixels[x, y] = 0

    output = ImageEnhance.Contrast(output).enhance(2.0)
    return upscale_image(output, args.upscale)


def ocr_image(processed_image: Image.Image, args: argparse.Namespace) -> str:
    return pytesseract.image_to_string(processed_image, config=args.tesseract_config)


def run_ocr_variants(image_path: Path, args: argparse.Namespace) -> dict[str, str]:
    image = Image.open(image_path)
    variants = {
        "ocr_default": image,
        "ocr_crop_gray": make_crop_gray(image, args),
        "ocr_crop_contrast": make_crop_contrast(image, args),
        "ocr_color_mask": make_color_mask(image, args),
    }
    return {name: ocr_image(processed_image, args).strip() for name, processed_image in variants.items()}


def score_ocr_text(text: str) -> int:
    cleaned = clean_ocr_text(text)
    cleaned_lower = cleaned.lower()
    words = re.findall(r"[A-Za-z][A-Za-z']+", cleaned)
    score = 0

    score += min(len(cleaned), 220)
    score += min(len(words), 45) * 6

    if re.search(r"(?m)^\s*[-–]\s+\S+", text):
        score += 80
    if len(words) >= 5:
        score += 40
    if re.search(r"[,.!?;:]", cleaned):
        score += 25
    if '"' in cleaned or "'" in cleaned:
        score += 8

    if len(cleaned) < 20:
        score -= 120
    if "quote of the day" in text.lower():
        score -= 60
    if "close window" in cleaned_lower:
        score -= 80
    if re.search(r"(c=\)|c=\]|\bqoq\b|@|[|]{2,}|\(ceo|\(ed)", text.lower()):
        score -= 55

    symbol_count = len(re.findall(r"[^A-Za-z0-9\s,.'\";:!?()\-–]", cleaned))
    score -= symbol_count * 8
    return score


def choose_best_ocr(variant_texts: dict[str, str]) -> tuple[str, str]:
    best_variant = max(OCR_VARIANTS, key=lambda name: score_ocr_text(variant_texts.get(name, "")))
    return best_variant, variant_texts.get(best_variant, "")


def copy_site_asset(parsed: ParsedImage, source_dir: Path, site_assets_dir: Path) -> Path:
    destination = site_assets_dir / parsed.month_folder / parsed.image_path.name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(parsed.image_path, destination)
    return destination


def make_row(
    parsed: ParsedImage,
    variant_texts: dict[str, str],
    chosen_variant: str,
    chosen_text: str,
    site_image_path: Path | None,
    args: argparse.Namespace,
) -> dict[str, str]:
    date_key = f"{parsed.month_number:02d}-{parsed.day:02d}"
    include_by_default = parsed.special_type == "" or args.include_specials
    site_path_text = ""
    if site_image_path is not None:
        site_path_text = site_image_path.as_posix()
        if site_path_text.startswith("site/"):
            site_path_text = site_path_text[len("site/") :]

    cleaned_lines = clean_ocr_lines(chosen_text)
    quote_text, author = parse_author_from_lines(cleaned_lines)
    if not quote_text:
        quote_text = clean_ocr_text(chosen_text)

    return {
        "id": make_quote_id(parsed),
        "date_key": date_key,
        "date_label": f"{parsed.month_name} {parsed.day}",
        "month_number": str(parsed.month_number),
        "month_name": parsed.month_name,
        "day": str(parsed.day),
        "filename": parsed.image_path.name,
        "source_image_path": parsed.image_path.as_posix(),
        "site_image_path": site_path_text,
        "raw_ocr_text": chosen_text.strip(),
        "cleaned_text": quote_text,
        "author": author,
        "special_type": parsed.special_type,
        "include_in_default_archive": str(include_by_default).lower(),
        "needs_review": "true",
        "notes": "",
        "ocr_default": variant_texts.get("ocr_default", ""),
        "ocr_crop_gray": variant_texts.get("ocr_crop_gray", ""),
        "ocr_crop_contrast": variant_texts.get("ocr_crop_contrast", ""),
        "ocr_color_mask": variant_texts.get("ocr_color_mask", ""),
        "ocr_chosen_variant": chosen_variant,
    }


def find_images(source_dir: Path) -> list[ParsedImage]:
    parsed_images: list[ParsedImage] = []
    for image_path in sorted(source_dir.rglob("*.png")):
        parsed = parse_image_path(image_path, source_dir)
        if parsed is None:
            print(f"Skipping unexpected image path: {image_path}")
            continue
        parsed_images.append(parsed)
    return parsed_images


def write_csv(rows: list[dict[str, str]], output_csv: Path) -> None:
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    args = parse_args()

    if args.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = args.tesseract_cmd

    source_dir = args.source_dir
    if not source_dir.exists():
        raise SystemExit(f"Source directory not found: {source_dir}")

    rows: list[dict[str, str]] = []
    parsed_images = find_images(source_dir)
    print(f"Found {len(parsed_images)} PNG file(s) to process.")

    for index, parsed in enumerate(parsed_images, start=1):
        print(f"[{index}/{len(parsed_images)}] OCR: {parsed.image_path}")
        site_image_path = None
        if not args.no_copy_assets:
            site_image_path = copy_site_asset(parsed, source_dir, args.site_assets_dir)

        variant_texts = run_ocr_variants(parsed.image_path, args)
        chosen_variant, chosen_text = choose_best_ocr(variant_texts)
        rows.append(make_row(parsed, variant_texts, chosen_variant, chosen_text, site_image_path, args))

    write_csv(rows, args.output_csv)
    print(f"Wrote {len(rows)} row(s) to {args.output_csv}")


if __name__ == "__main__":
    main()

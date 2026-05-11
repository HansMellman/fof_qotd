"""Build a simple local HTML review page from an OCR CSV."""

from __future__ import annotations

import argparse
import csv
import html
from pathlib import Path


OCR_FIELDS = [
    "ocr_default",
    "ocr_crop_gray",
    "ocr_crop_contrast",
    "ocr_color_mask",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build data/review.html for manual OCR review.")
    parser.add_argument("--input-csv", type=Path, default=Path("data/quotes_raw_v2.csv"))
    parser.add_argument("--output-html", type=Path, default=Path("data/review.html"))
    return parser.parse_args()


def read_rows(input_csv: Path) -> list[dict[str, str]]:
    with input_csv.open("r", newline="", encoding="utf-8-sig") as csv_file:
        return list(csv.DictReader(csv_file))


def site_image_to_review_path(site_image_path: str) -> str:
    if not site_image_path:
        return ""
    return "../site/" + site_image_path.replace("\\", "/")


def escaped_pre(value: str) -> str:
    return html.escape(value or "").strip()


def render_ocr_variants(row: dict[str, str]) -> str:
    parts: list[str] = []
    chosen = row.get("ocr_chosen_variant", "")
    for field in OCR_FIELDS:
        value = row.get(field, "")
        if not value:
            continue
        label = field.replace("ocr_", "").replace("_", " ")
        chosen_text = " chosen" if field == chosen else ""
        parts.append(
            f"""
            <details>
              <summary>{html.escape(label)}{chosen_text}</summary>
              <pre>{escaped_pre(value)}</pre>
            </details>
            """
        )
    return "\n".join(parts)


def render_row(row: dict[str, str]) -> str:
    image_path = site_image_to_review_path(row.get("site_image_path", ""))
    special = row.get("special_type", "")
    special_html = f'<span class="badge">{html.escape(special)}</span>' if special else ""
    image_html = ""
    if image_path:
        image_html = f'<img src="{html.escape(image_path)}" alt="Screenshot for {html.escape(row.get("date_label", ""))}">'

    return f"""
    <article class="quote">
      <header>
        <div>
          <h2>{html.escape(row.get("date_label", ""))}</h2>
          <p>{html.escape(row.get("id", ""))} {special_html}</p>
        </div>
        <p class="review">needs_review: {html.escape(row.get("needs_review", ""))}</p>
      </header>
      <div class="layout">
        <div class="image-panel">{image_html}</div>
        <div class="text-panel">
          <h3>Chosen cleaned text</h3>
          <blockquote>{html.escape(row.get("cleaned_text", "") or "[blank]")}</blockquote>
          <h3>Author</h3>
          <p>{html.escape(row.get("author", "") or "[blank]")}</p>
          <h3>OCR variants</h3>
          {render_ocr_variants(row)}
        </div>
      </div>
    </article>
    """


def render_page(rows: list[dict[str, str]], input_csv: Path) -> str:
    body = "\n".join(render_row(row) for row in rows)
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>FOF QOTD OCR Review</title>
    <style>
      * {{ box-sizing: border-box; }}
      body {{
        margin: 0;
        background: #f6f4ef;
        color: #202326;
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.45;
      }}
      main {{
        max-width: 1180px;
        margin: 0 auto;
        padding: 28px 18px 60px;
      }}
      h1 {{ margin: 0 0 6px; }}
      .intro {{ margin: 0 0 22px; color: #687076; }}
      .quote {{
        margin: 0 0 18px;
        border: 1px solid #d9d4ca;
        border-radius: 8px;
        background: #fff;
        padding: 18px;
      }}
      header {{
        display: flex;
        justify-content: space-between;
        gap: 18px;
        border-bottom: 1px solid #ece7dd;
        margin-bottom: 16px;
        padding-bottom: 12px;
      }}
      h2, p {{ margin: 0; }}
      .review {{ color: #687076; font-weight: 700; }}
      .badge {{
        display: inline-block;
        margin-left: 8px;
        border-radius: 999px;
        background: #f0e8ff;
        color: #6f2dbd;
        padding: 2px 8px;
        font-size: 0.78rem;
        font-weight: 700;
      }}
      .layout {{
        display: grid;
        grid-template-columns: minmax(260px, 48%) minmax(280px, 1fr);
        gap: 18px;
      }}
      img {{
        width: 100%;
        height: auto;
        border: 1px solid #d9d4ca;
        border-radius: 6px;
      }}
      h3 {{ margin: 0 0 6px; font-size: 0.95rem; color: #115e59; }}
      blockquote {{
        margin: 0 0 16px;
        border-left: 4px solid #0f766e;
        padding-left: 12px;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 1.15rem;
      }}
      details {{
        margin: 8px 0;
        border: 1px solid #d9d4ca;
        border-radius: 6px;
        padding: 8px 10px;
      }}
      summary {{ cursor: pointer; font-weight: 700; }}
      pre {{
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        margin: 8px 0 0;
        font-family: Consolas, "Courier New", monospace;
      }}
      @media (max-width: 760px) {{
        header, .layout {{ display: block; }}
        .image-panel {{ margin-bottom: 16px; }}
      }}
    </style>
  </head>
  <body>
    <main>
      <h1>FOF QOTD OCR Review</h1>
      <p class="intro">Source CSV: {html.escape(str(input_csv))}. Rows: {len(rows)}.</p>
      {body}
    </main>
  </body>
</html>
"""


def main() -> None:
    args = parse_args()
    if not args.input_csv.exists():
        raise SystemExit(f"Input CSV not found: {args.input_csv}")

    rows = read_rows(args.input_csv)
    args.output_html.parent.mkdir(parents=True, exist_ok=True)
    args.output_html.write_text(render_page(rows, args.input_csv), encoding="utf-8")
    print(f"Wrote review page for {len(rows)} row(s): {args.output_html}")


if __name__ == "__main__":
    main()

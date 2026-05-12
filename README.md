# FOF8 Quote of the Day Archive

This project creates a searchable static archive of Front Office Football 8 Quote of the Day screenshots.

The screenshots use a stylised font, so OCR will not be perfect. The intended workflow is to generate `data/quotes_raw_v2.csv`, manually review and correct it, then build `quotes.json` for the static website.

## Folder Structure

```text
source_images/
  01_Jan/
    01_Jan.png
    02_Jan.png
  02_Feb/
    29_Feb.png
  04_Apr/
    01_Apr_FAKE.png
tools/
data/
site/
docs/
```

The normal archive should contain 365 screenshots. `29_Feb.png` and `01_Apr_FAKE.png` are supported as special extras.

## Install Dependencies

Create and activate your own virtual environment, then install the Python packages:

```powershell
pip install -r requirements.txt
```

This project uses `pillow` and `pytesseract`, but it does not bundle Tesseract itself. On Windows, install Tesseract OCR separately if it is not already installed. A common install path is:

```text
C:\Program Files\Tesseract-OCR\tesseract.exe
```

## Validate Screenshots

```powershell
python tools/validate_archive.py
```

This checks month folders, counts PNG files, reports missing normal dates, and tolerates leap day or fake quote extras.

## Extract OCR

```powershell
python tools/extract_quotes.py
```

If Tesseract is not on your `PATH`, pass the executable path:

```powershell
python tools/extract_quotes.py --tesseract-cmd "C:\Program Files\Tesseract-OCR\tesseract.exe"
```

Useful options:

```powershell
python tools/extract_quotes.py --output-csv data/quotes_raw_v2.csv
python tools/extract_quotes.py --contrast 2.0 --upscale 3
python tools/extract_quotes.py --no-copy-assets
python tools/extract_quotes.py --include-specials
```

The script writes `data/quotes_raw_v2.csv` by default and copies screenshots into `site/assets/quotes/`. It runs several OCR variants and stores the diagnostics in extra CSV columns:

- `ocr_default`
- `ocr_crop_gray`
- `ocr_crop_contrast`
- `ocr_color_mask`
- `ocr_chosen_variant`

The original CSV columns are still present, so `build_json.py` remains compatible.

## Build Review Page

After extracting OCR, build a local review page:

```powershell
python tools/build_review_html.py --input-csv data/quotes_raw_v2.csv
```

Open `data/review.html` in your browser. It shows each screenshot beside the chosen cleaned text, author, special type, review flag, and OCR variants.

## Manual Review

Open `data/quotes_raw_v2.csv` in Excel, LibreOffice, or another CSV editor. Use `data/review.html` alongside it when checking difficult rows. Correct at least these fields:

- `cleaned_text`
- `author`
- `needs_review`
- `notes`

Save the corrected file as:

```text
data/quotes_clean.csv
```

Keep `raw_ocr_text` so you can compare the original OCR output later.

## Build JSON

```powershell
python tools/build_json.py
```

The script reads `data/quotes_clean.csv` by default. If that file does not exist, it falls back to `data/quotes_raw.csv` and prints a warning.

It writes:

```text
data/quotes.json
site/data/quotes.json
```

## Author Metadata

The author metadata workflow is separate from the quote archive data. It creates a manually reviewable metadata CSV and generated JSON for a future About Authors feature:

```powershell
python tools/build_author_metadata_template.py
python tools/check_author_metadata.py
python tools/build_authors_json.py
```

See `docs/AUTHOR_METADATA_WORKFLOW.md` for the full process. Do not invent author facts; use `verified=true` only after manual checking.

## Preview the Website

The site is plain HTML, CSS, and JavaScript. Some browsers block `fetch()` when opening local files directly, so a tiny local server is the most reliable preview method:

```powershell
python -m http.server 8000 --directory site
```

Then open:

```text
http://localhost:8000
```

## Deploy

Deploy the contents of `site/` to GitHub Pages or any static hosting provider. No backend server, database, Node, or build step is required.

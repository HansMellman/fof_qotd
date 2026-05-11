# FOF8 QOTD Archive Workflow

## 1. Put Screenshots in `source_images/`

Use month folders like this:

```text
source_images/
  01_Jan/
    01_Jan.png
    02_Jan.png
  02_Feb/
    01_Feb.png
```

Special supported extras:

```text
source_images/02_Feb/29_Feb.png
source_images/04_Apr/01_Apr_FAKE.png
```

## 2. Run Validation

```powershell
python tools/validate_archive.py
```

Review the summary for missing month folders, missing dates, duplicate dates, and unrecognized file names.

## 3. Run OCR Extraction

```powershell
python tools/extract_quotes.py
```

If Tesseract OCR is not on your Windows `PATH`, use:

```powershell
python tools/extract_quotes.py --tesseract-cmd "C:\Program Files\Tesseract-OCR\tesseract.exe"
```

The extractor writes `data/quotes_raw_v2.csv` by default so it does not overwrite an existing `data/quotes_raw.csv`. You can choose another path with:

```powershell
python tools/extract_quotes.py --output-csv data/quotes_raw_v2.csv
```

It runs several OCR passes:

- default OCR
- cropped grayscale, upscaled
- cropped grayscale with contrast and sharpness, upscaled
- colour-mask OCR for light quote text and red author text

This creates `data/quotes_raw_v2.csv` and copies image assets into `site/assets/quotes/`.

## 4. Build the Review Page

```powershell
python tools/build_review_html.py --input-csv data/quotes_raw_v2.csv
```

Open:

```text
data/review.html
```

Use it to compare the screenshot, chosen cleaned text, parsed author, and OCR variants.

## 5. Open `data/quotes_raw_v2.csv`

Open the CSV in Excel, LibreOffice, or another editor that preserves CSV columns.

## 6. Correct Quote Fields

OCR on the stylised quote font will need human checking. Review and correct:

- `cleaned_text`
- `author`
- `needs_review`
- `notes`

Leave `raw_ocr_text` intact as the original OCR reference.

## 7. Save as `data/quotes_clean.csv`

Save your reviewed copy as:

```text
data/quotes_clean.csv
```

## 8. Build JSON

```powershell
python tools/build_json.py
```

This writes:

```text
data/quotes.json
site/data/quotes.json
```

## 9. Preview Site Locally

```powershell
python -m http.server 8000 --directory site
```

Open:

```text
http://localhost:8000
```

## 10. Deploy Site

Publish the `site/` folder to GitHub Pages or another static host. The finished archive is static HTML, CSS, JavaScript, JSON, and image files.

## Tesseract OCR Note

`pytesseract` is only a Python wrapper. You must install Tesseract OCR separately on Windows if it is not already installed.

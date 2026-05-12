# Author Metadata Workflow

The author metadata layer is separate from the quote archive data. Do not edit `data/quotes_clean.csv` or change the quote JSON schema for author notes.

## 1. Build the Template

```powershell
python .\tools\build_author_metadata_template.py
```

This reads `site/data/quotes.json`, extracts unique authors, counts their quotes, and writes:

```text
data/author_metadata.csv
```

The template does not overwrite an existing metadata CSV unless you pass:

```powershell
python .\tools\build_author_metadata_template.py --force
```

## 2. Manually Fill Metadata

Open `data/author_metadata.csv` in Excel, LibreOffice, or another CSV editor.

Fill only what you can verify. The archive contains a mix of real people, literary references, fictional FOF-universe names, developer references, and pop-culture references.

Do not invent facts. If an entry is uncertain, keep:

```text
needs_research=true
verified=false
```

Use `verified=true` only when the row has been manually checked.

Suggested `author_type` values:

```text
real_football_person
real_historical_person
literary_character
film_or_pop_culture_character
fof_universe_fictional
developer
unknown
```

Use semicolons in `tags` when adding multiple tags:

```text
football;coach;real_person
```

## 3. Check the Metadata

```powershell
python .\tools\check_author_metadata.py
```

The checker reports:

- authors in `quotes.json` missing from `author_metadata.csv`
- authors in metadata not present in `quotes.json`
- duplicate `author_key` values
- blank `display_name`
- blank `full_author`
- quote count mismatches
- rows where `verified=true` but `author_type` is blank
- rows where `verified=true` but `short_note` is blank

It does not modify files.

## 4. Build Author JSON

```powershell
python .\tools\build_authors_json.py
```

This writes:

```text
data/authors.json
site/data/authors.json
```

The `tags` CSV field is converted into a JSON array.

## 5. Use Later in the Frontend

A future About Authors feature can load:

```text
site/data/authors.json
```

Keep quote data and author metadata separate. The quote archive should continue to use `site/data/quotes.json`, and author details should live in the metadata files.

---
name: duadigital-pdf-maker
description: Convert a Markdown file to a branded Dua Digital PDF
---

# PDF — Markdown to branded PDF

Convert a Markdown file to a print-ready, Dua Digital-branded PDF.

## Usage

```
/skill:duadigital-pdf-maker path/to/document.md
```

Use the path supplied by the user as the input `.md` file. Resolve bundled files relative to this skill directory.

Before writing or overwriting files, show the proposed content or command and wait for approval. Ask before deleting files.

## Steps

### 0. Markdown format review (MANDATORY — blocker)

Before any conversion, validate the markdown against the bundled `FORMAT.md`.

1. Read `FORMAT.md`.
2. Read the input markdown at the path supplied by the user.
3. Check every required section in the FORMAT validation table. For each missing or malformed item, present a numbered checklist to the user:

   ```
   ## Markdown Review

   Missing / incomplete:
   1. [ ] **Valid until (due date)** — not found in Price section.
          Client-facing offers need an expiration date. What date? (YYYY-MM-DD)
   2. [ ] **Payment section** — missing.
          Add standard "50% upfront / 50% on delivery" or other?

   Formatting issues:
   - Meta block uses blank-line separators instead of hard line breaks (two trailing spaces).
     Auto-fix? (y/n)
   ```

4. Wait for the user's answers. Show the proposed fixes and obtain approval before applying them to the markdown file in place.
5. Re-run the check silently — if anything is still missing, loop back to step 3.
6. Only proceed to step 1 once the review passes.

If the document is not a client-facing proposal/estimate (e.g. internal notes), the user can say "skip review" to bypass.

### 1. Read inputs

- Read the Markdown file at the path supplied by the user (resolve relative to the current working directory).
- Read the branded CSS from the bundled `assets/styles.css`.

### 2. Convert Markdown to HTML

Convert the Markdown content to semantic HTML. Apply these rules:

- Use proper HTML tags: `<h1>`–`<h6>`, `<p>`, `<ul>`, `<ol>`, `<li>`, `<blockquote>`, `<table>`, `<pre><code>`, `<a>`, `<strong>`, `<em>`, `<hr>`, `<img>`.
- For fenced code blocks with a language tag, add `class="language-{lang}"` on the `<code>` element.
- Support GitHub Flavored Markdown: tables, task lists, strikethrough, fenced code blocks.
- Derive a document title from the first `# Heading` or from the filename.

### 3. Build full HTML document

Wrap the converted HTML body in this template. **Inline the entire CSS** from `styles.css` into the `<style>` tag — do not use a `<link>` tag:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{TITLE}}</title>
  <style>
    {{STYLES_CSS_CONTENT}}
  </style>
</head>
<body>
  <header class="brand-hero" aria-label="Dua Digital">
    <span class="brand-word">dua</span>
    <span class="brand-word">digital</span>
  </header>
  <main>
    {{BODY_HTML}}
  </main>
  <footer style="margin-top: 2em; padding-top: 1em; border-top: 1px solid #e0e0e0; font-size: 8pt; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #999;">
    <span>duadigital.com &middot; hello@duadigital.com</span>
  </footer>
</body>
</html>
```

### 3b. Page break hygiene

The CSS handles most page breaks automatically (`break-inside: avoid` on paragraphs, lists, tables, etc.). To prevent awkward splits, also apply these rules when building the HTML:

- **Short label + list pairs** (a bold `<p>` followed by a `<ul>`/`<ol>` with ≤ 5 items): wrap in `<section>` to keep them together on one page.
- **Heading + intro + table/list**: the CSS glues a heading and an intro paragraph (`p:has(+ table)`, `p:has(+ ul)`, `p:has(+ ol)`) to the block that starts the section. Because `table { break-inside: avoid }` moves a whole table to the next page when it doesn't fit, this keeps the heading + intro from being stranded alone — they move down with the table. Keep the intro sentence as a `<p>` immediately before the table/list so the rule fires.
- **Do NOT wrap large blocks** in `<section>` — if the combined content is taller than ~half a page, let it flow naturally. The CSS already keeps individual paragraphs and list items intact.
- **Heading + intro orphans**: if a heading is followed by a short intro sentence and then a `<section>`, include the intro sentence inside the `<section>` so it doesn't get stranded alone on the previous page.

### 4. Write the HTML file

Write the HTML to a file next to the input, with the same name but `.html` extension.
Example: `report.md` → `report.html`

### 5. Generate PDF via Chrome

Run this command to convert the HTML to PDF:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="{{OUTPUT_PDF}}" "{{INPUT_HTML}}"
```

Where:
- `{{OUTPUT_PDF}}` is the same base name with `.pdf` extension (e.g. `report.pdf`)
- `{{INPUT_HTML}}` is the **absolute path** to the HTML file written in step 4

### 6. Clean up

Verify the PDF was successfully created, then ask for approval before deleting the intermediate `.html` file.

### 7. Report

Tell the user the PDF was created and print its path.

## Brand reference

These are the Dua Digital brand constants (already baked into `styles.css`):

| Token          | Value                                                       |
|----------------|-------------------------------------------------------------|
| Text           | `#1a1a1a`                                                   |
| Text secondary | `#666666`                                                   |
| Background     | `#ffffff`                                                   |
| Accent         | `#333333`                                                   |
| Accent light   | `#f5f5f5`                                                   |
| Header rule    | `#e0e0e0`                                                   |
| Body font      | Helvetica Neue, Helvetica, Arial, sans-serif                |
| Mono font      | SF Mono, Menlo, monospace                                   |
| Logo           | "dua digital" — small (16pt) wordmark, top-left corner, semibold Helvetica Neue, no divider line |

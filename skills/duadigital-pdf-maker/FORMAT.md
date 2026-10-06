# Dua Digital Proposal — Markdown Format

Structure every client proposal / estimate markdown file to match this template before converting to PDF. Matches the style used in `proposal-full-sv.pdf` and `proposal-website-2026.md`.

## Required structure

```markdown
# {Client} — {Document type}

**Prepared for:** {Client legal name}  
**Prepared by:** Dua Digital Solutions  
**Date:** {YYYY-MM-DD}

---

## 1. Overview / What We're Building

{Short paragraph — what this is and why.}

---

## 2. Deliverables

{Broken into subsections with `###` headings. Use bullet lists.}

### {Subsection}
- item
- item

---

## 3. Price

| Deliverable | Price (EUR) |
|---|---|
| {Item} | €X,XXX |
| **Total** | **€X,XXX** |

{One line summary of what's included.}

**Valid until:** {YYYY-MM-DD}

---

## 4. Optional: {Add-on}

{Description.}

| Deliverable | Price (EUR) |
|---|---|
| {Item} | €X – €X |

---

## 5. Hosting / Infrastructure
## 6. What We Need From You
## 7. Timeline
## 8. Payment
## 9. Next Steps
## 10. Good to Know

---

*Dua Digital Solutions*
```

## Format rules

1. **Meta block** — each field on its own line, terminated with two trailing spaces (hard line break). No blank lines between them.
2. **Section dividers** — use `---` (horizontal rule) between numbered top-level sections. The PDF stylesheet renders these as a thin divider.
3. **Price tables** — always use a markdown table with a header row (`Deliverable | Price (EUR)`). Never use a "headless" single-row table; never use raw HTML price boxes.
4. **Headings** — `##` for numbered sections, `###` for subsections. Numbering is explicit (`## 1. …`).
5. **Lists** — blank line before and after.
6. **Homepage / flow / screen lists** — use ordered lists with bold labels: `1. **Hero** — description`.
7. **Numbers & currency** — prices in EUR with `€` prefix, thousand separator as space or comma (stay consistent within a doc).
8. **Footer** — end file with `*Dua Digital Solutions*` on its own line.

## Required sections (validation)

The following sections MUST be present before PDF generation. If any are missing, the skill asks the user.

| Section | Check |
|---|---|
| Title (H1) | First line is `# …` |
| Prepared for | Regex `**Prepared for:**` |
| Prepared by | Regex `**Prepared by:**` |
| Date | Regex `**Date:**` or `**Datum:**`, value must be full `YYYY-MM-DD` (not `Month Year`) — required so the 30-day validity window is unambiguous |
| Price section | Heading matching `Price`, `Pris`, `Prissättning`, `Estimate`, or `Estimat` |
| **Valid until** (due date) — inside the Price section | Regex `**Valid until:**` or `**Giltig till:**` |
| Timeline | Heading matching `Timeline`, `Tidsplan`, or equivalent |
| Payment | Heading matching `Payment`, `Betalning`, or equivalent |
| Next Steps | Heading matching `Next Steps` or `Nästa steg` |

Non-required but recommended (flag as warning, not blocker):
- Good to Know / Bra att veta
- What We Need From You / Vad vi behöver från er
- Scope boundaries / exclusions

## Voice

Dua Digital brand voice: lugn kompetens, rak kommunikation, kollega not säljare. No buzzwords, no hedging, no superlatives.

## Leak rules

Never include: internal hours, rates, margins, team member names, internal tool references (Linear, Slack, Grafana), repo names, AI tooling references.

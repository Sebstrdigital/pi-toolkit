# One-pager presentation format

The renderer accepts a UTF-8 JSON file and creates a new self-contained HTML file. Node 20+ and no npm dependencies are required. All prose is escaped; the JSON does not accept raw HTML, script, or SVG. Basic `**bold**` and backtick code formatting is supported in prose. Prefer ordinary text otherwise.

## Top-level fields

```json
{
  "title": "Clear document title",
  "summary": "A concise overview of the purpose and main conclusion.",
  "language": "en",
  "modes": ["explainer", "briefing"],
  "sources": [
    {"id": "proposal", "label": "Authoritative proposal", "path": "./proposal.md"},
    {"id": "research", "label": "Research evidence", "url": "https://example.org/research"}
  ],
  "sections": [
    {"title": "How it works", "blocks": [
      {"type": "text", "text": "An evidence-grounded explanation.", "references": ["proposal"]}
    ]}
  ],
  "decisions": []
}
```

Required: `title`, `summary`, `modes` (1–4 distinct supported IDs), and nonempty `sections`. Optional: `language` (default `en`), `sources`, `decisions`. Local paths resolve relative to the JSON input. Each source needs a unique `id`, `label`, and exactly one `path` or HTTP(S) `url`. Local UTF-8 text sources are embedded in full, rendered readably, and accompanied by exact source text and SHA-256. URL sources are navigation links, not fetched or verified by the renderer. The agent must inspect their evidence before citing them.

Each section needs a `title` and `blocks` array. Blocks can have optional `references` arrays of source IDs. Unknown IDs fail generation. Source citations navigate to the Sources section, and local sources link to their complete embedded document. Section anchors are `section-1`, `section-2`, etc.

## Blocks

- **text:** `{"type":"text","text":"Plain-language paragraph","references":["proposal"]}`
- **list:** `{"type":"list","items":["One point","Another point"]}`
- **table:** `{"type":"table","headers":["Option","Trade-off"],"rows":[["A","Simple"],["B","Flexible"]]}`. Every row must match the header count.
- **steps:** `{"type":"steps","items":[{"title":"First step","text":"What to do and how to check it."}]}`
- **details:** `{"type":"details","title":"Supporting evidence","blocks":[{"type":"text","text":"The deeper explanation."}]}`. Nest sparingly (maximum depth 8).
- **diagram:**

```json
{
  "type": "diagram",
  "title": "Request flow",
  "description": "What this flow explains, including any inferred relationship.",
  "references": ["proposal"],
  "nodes": [
    {"id":"input","label":"Input document"},
    {"id":"presentation","label":"Browser presentation"},
    {"id":"feedback","label":"Explicitly submitted feedback"}
  ],
  "edges": [
    {"from":"input","to":"presentation","label":"Rendered and explained"},
    {"from":"presentation","to":"feedback","label":"User exports their position"}
  ]
}
```

Diagrams use 1–8 unique nodes and at most 12 edges with known distinct endpoints. Keep labels short enough for two lines. The renderer creates inline SVG plus a text list of every relationship. Use multiple focused diagrams rather than one dense map. Do not fabricate source facts to fill a diagram.

## Decision review

Only `decision-review` mode permits decision controls. It requires at least one real proposal in `decisions`. Each decision must contain:

```json
{
  "id": "stable-choice-id",
  "title": "Use one browser artifact",
  "proposal": "The actual proposal awaiting review, not an invented decision.",
  "rationale": "Why it is proposed.",
  "alternatives": ["The considered alternatives and their trade-offs."],
  "consequences": ["Expected consequences, risks, and boundaries."],
  "references": ["proposal"]
}
```

IDs must be unique; references must be nonempty and refer to declared sources. Rationale, alternatives, and consequences are expandable. Each decision and the overall position start `pending` (Not reviewed). The user may select `accept`, `changes`, or `undecided`, and add comments. Overall acceptance is not calculated from individual choices. Contradictory positions trigger a visible warning, not silently changed answers.

JSON and plain-text review exports retain **all** decisions, including pending ones, the overall position, comments, source paths/URLs, exact local-source SHA-256 hashes, the JSON specification hash, and the combined content hash. Draft storage uses the content hash, so changed source/spec content does not inherit acceptance. Local storage is best-effort and may fail for file URLs or private browsing; exports remain available. No feedback is sent automatically.

## Creation and opening

```bash
node /absolute/skill/one-pager/scripts/render.mjs /absolute/review.json /absolute/review.html
open /absolute/review.html
```

The CLI refuses existing output (including symlinks). It emits the absolute output path, byte count, and HTML SHA-256; this is generation evidence, not evidence of user acceptance or a browser opening. The page blocks background connections and external runtime dependencies with a content security policy. External source links still allow deliberate navigation. Browser-dependent clipboard/storage features have fallback paths.

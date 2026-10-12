# One-pager: browser presentations on demand

The `one-pager` skill turns conversation material, research results, guides, or proposals into one readable, self-contained HTML document. It is a modern presentation rather than a strict one-print-page limit. A concise overview leads into useful visuals and expandable depth.

## Invocation

```text
/skill:one-pager turn our research into a browser presentation
/skill:one-pager make an explainer and decision review from docs/adr/0001.md
```

Or ask normally: “Make a one-pager from this.” The skill loads only for a presentation request.

If you did not specify modes, the companion `one_pager_mode` tool presents five native choices:

| Choice | Purpose |
|---|---|
| Briefing | Findings, evidence, and recommendations |
| Guide | Steps, instructions, and practical examples |
| Explainer | Concepts, relationships, and visualizations |
| Decision review | Choices, trade-offs, risks, and feedback |
| Combine modes | Two or more modes woven into one document |

The agent supplies the recommendation and its reason from the current conversation. Exactly one top-level option gets `(recommended)`; when several modes are recommended, that tag belongs to Combine modes. The follow-up picker marks recommended individual modes but starts with no boxes checked. Use arrows to navigate, Enter to select, Space/Enter to toggle combined modes, then select “Use selected modes.” Escape cancels without accepting the recommendation. At least two modes are required for a combination.

Explicit mode requests skip both questions. “You choose” explicitly delegates the presentation choice. Combinations yield one coherent narrative, not repeated templates.

## Activation (separate permission required)

Nothing is installed by implementing the repository files. After approving installation:

```bash
bash install.sh --with-one-pager
```

This opt-in adds only `skills/one-pager` and `extensions/one-pager` alongside the toolkit's existing default links. It does not change settings or install packages. It preflights conflicts and refuses to overwrite files, directories, or conflicting/dangling links. Keep the checkout in place; restart Pi or use `/reload` after installation.

For a session-only trial without global installation, launch Pi with the explicit extension and skill:

```bash
pi -e ./extensions/one-pager/index.ts --skill ./skills/one-pager
```

The native terminal picker uses Pi's UI components, not a generic questionnaire dependency. RPC uses built-in select dialogs (repeated toggles for combinations); JSON/print mode reports that UI is unavailable. Without the extension the skill can ask the same options in text, but cannot display a native widget. No new commands, persistent defaults, automatic model calls, or background resources are registered by the extension.

## HTML and source fidelity

The agent writes a presentation JSON and runs `skills/one-pager/scripts/render.mjs`. The renderer embeds CSS, JavaScript, SVG diagrams, and complete local text sources in a new HTML file. It needs Node 20+ but no npm packages or server. It refuses to overwrite prior output.

The page has readable typography, light/dark themes, responsive navigation, expandable details, comparison tables, guide steps, and diagrams with text equivalents. It blocks background network connections; only explicit source links navigate externally. Linked websites and videos are not copied offline. Source material is escaped and cannot inject HTML or JavaScript.

For formal document review, the skill includes the whole authoritative document as a local source: a readable Markdown rendering plus exact source text. It computes SHA-256 from the actual source bytes rather than trusting an agent-supplied fingerprint. Complete source availability is not proof that the user read or understood it. The small Markdown reader supports headings, paragraphs, lists, tables, fences, bold, inline code, and safe external links. Relative document links display their label and path rather than opening a broken location. Unsupported syntax remains visible, with exact text available.

## Feedback is not authority

Decision review adds per-decision positions/comments and a separate overall position. All begin Not reviewed. The browser never writes to the ADR, modifies project state, submits feedback, or authorizes implementation.

Drafts are best-effort, content-hash-scoped browser storage. Export JSON or text, or copy the review, and submit it back to the agent. Exports include pending decisions, all comments, source identities/hashes, and the presentation/content hashes. Changed material does not inherit prior acceptance. The project's actual approval process determines whether the submitted review constitutes acceptance and what it authorizes.

HTML may embed sensitive documents. Do not publish it without inspection and permission.

## Examples and validation

A worked Explainer + Guide example lives at `skills/one-pager/references/example.json`:

```bash
node skills/one-pager/scripts/render.mjs skills/one-pager/references/example.json /tmp/one-pager-example.html
open /tmp/one-pager-example.html
```

Use a fresh output filename if it already exists. Format and mode guidance live under `skills/one-pager/references/`. Tests use Pi's actual extension loader, exercise the native selection components and RPC fallback, and verify generation, escaping, source identities, and output conflict handling. Browser checks require a separate real browser; repository tests alone do not certify subjective readability or human acceptance.

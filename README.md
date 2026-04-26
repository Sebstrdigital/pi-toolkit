# pi-toolkit

Toolkit for working productively with [pi](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) — badlogic's minimal coding agent. Pi is bare by design (no plan mode, no subagents, no permissions, no MCP, no todos); this repo adds reusable primitives without bloating pi itself.

## Layers

- **`pi-roles/`** — library of role skills (scout, architect, builder, verifier, reviewer, debugger). Markdown only. Symlinked into pi's skill discovery paths. Reusable standalone (`/skill:scout`) or composed inside chains.
- **`pi-chains/`** — pi extension that reads YAML chain definitions and runs roles sequentially via `child_process.spawn("pi", ...)`. Surfaces `/chain-run`, `/chain-list`, `/chain-resume`.

Workflow consumers (takt, audit, refactor, ad-hoc chains) live in their own repos and reference these primitives.

## Status

Planning + Phase 0. See [`PLAN.md`](PLAN.md) for the full implementation plan and [`docs/roles-library.md`](docs/roles-library.md) for the v1 role inventory (under review).

This README will grow as the toolkit takes shape.

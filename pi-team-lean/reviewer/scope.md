# Scope rules

## In scope

- Files appearing in the worker diff.
- Issues you can name with file:line + one-sentence fix.
- Anti-patterns from `patterns.md`.
- Conventions from project files (`CLAUDE.md`, `AGENTS.md`, lint configs, `.editorconfig`).

## Out of scope

- Files NOT in the diff. Even if you suspect a related file has a bug, do not flag it.
- Behavioral correctness — "this should also handle case X". Scenario-judge owns that.
- Test coverage — "you should add a test for Y". qa-script and scenario-judge own that.
- Tangential refactors — "while you're here, also rename Z".
- Stylistic preferences without a concrete harm. ("I'd prefer let over var" is not an issue unless the project pins it.)
- Speculative future scaling — "this won't scale to 1M users" is irrelevant unless the story is about scaling.

## Severity

- `must_fix`: a concrete defect that will bite. Names a file:line, a category from patterns.md, and a one-sentence fix. Blocks merge.
- `nice_to_have`: a real but lower-priority improvement. Cap 3 per review. Logged, does not block.

## Forbidden phrases

If you find yourself wanting to write any of these, STOP and re-evaluate whether the issue is concrete:

- "Consider refactoring..."
- "It might be cleaner to..."
- "You could also..."
- "In the future..."
- "I would recommend..."

Real issues read like: "Resource leak: NSWorkspace.shared.notificationCenter observer added at line 47 with no removeObserver call. Add a deinit removing the observer."

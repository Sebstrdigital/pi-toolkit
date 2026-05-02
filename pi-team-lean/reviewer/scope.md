# Scope rules

## In scope

- Files appearing in the worker diff.
- Issues you can name with file:line + one-sentence fix.
- Anti-patterns from `patterns.md`.
- Conventions from project files (`CLAUDE.md`, `AGENTS.md`, lint configs, `.editorconfig`).
- **Scope creep by the worker.** See "Scope creep gate" below.

## Scope creep gate (HARD)

The story body lists what is in scope: file paths, modules, behaviors. The worker is not authorized to touch anything else.

Procedure (run this FIRST, before walking patterns.md):

1. List every file path that appears in the diff (added, modified, or deleted).
2. For each file, check whether the story body mentions it (by exact path, by directory, or by clear semantic reference — e.g. story says "add a rate limiter middleware" and the file is `src/middleware/rateLimit.js`, that counts).
3. Any file in the diff that is NOT plausibly within the story's stated scope is scope creep. Flag it as a `must_fix` issue with category `scope_creep`. The `problem` should name the file and quote (or paraphrase) what the story actually asked for. The `suggested_fix` should be: "Revert changes to <file>; out of scope for this story."

Common scope-creep patterns to catch:

- Worker modified an unrelated test file's assertions to make a pre-existing failure pass. (Does NOT count as fixing the story; counts as silently rewriting tests.)
- Worker "while I was here" refactored a file the story did not mention.
- Worker bumped a dependency or edited config (`package.json`, `tsconfig.json`, `.eslintrc`, etc.) without the story asking for it.

Exceptions (NOT scope creep):

- A file the story explicitly authorizes (`update src/x.js`, `add tests in src/tests/x.test.js`).
- A file whose change is mechanically required by the story (e.g. registering a new route in `routes/index.js` when the story said "add a route handler").
- The worker's own new files within the path the story specified.

If in doubt, flag it. The worker can argue scope in the next iteration.

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

# pi-roles — Role Library v1

**Status:** Signed off 2026-04-26. Cleared for Phase 1 SKILL.md authoring.

**Date:** 2026-04-26.

**Sign-off notes:**
- Tier names approved: `worker-grade` / `critic-grade` / `architect-grade`.
- Builder bash lockout kept for v1 (verifier owns test runs).
- Architect kept in v1 but Sebastian will rarely invoke it — keep the spec lean; revisit after spike.
- Reviewer reads **diff** (not full files) via `git diff`, mirroring human PR review. Tools updated to include `bash` for read-only git inspection only.

---

## Conventions

- **Tool vocabulary** (subset of pi built-ins, names match `--tools` CSV exactly): `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`.
- **Tool source-of-truth.** Each role declares `allowed-tools` in SKILL.md frontmatter (space-delimited). pi-chains spawner reads it and passes the same list as `--tools <csv>` at spawn — that's the hard gate. Skill body still re-states tool restrictions in prose so the model self-restricts even on misconfig.
- **Model tier.** Informational only in v1. Spawner default = inherit pi's active model (no `--model` flag passed). `tier` field guides future per-role pinning when Sebastian has paid providers.
- **Output discipline.** Every role's last message must be a self-contained Markdown document — that's what pi-chains pipes as `$INPUT` to the next step. No "I'll continue later" cliffhangers.
- **Citations.** Every factual claim cites `path/to/file:line`. Hallucination is the single biggest failure mode at small-model scale.

---

## Role 1 — `scout`

**Purpose.** Read-only codebase reconnaissance. Maps files, surfaces patterns, identifies the slice of code relevant to a task.

| Field | Value |
|---|---|
| Tools | `read grep find ls` |
| Tier (informational) | worker-grade (cheap model OK; this is pattern-matching, not reasoning) |

**Inputs.** Original task description. Optionally: prior scout findings (for `scout-flow` triple-recon chain) or focus hints (`@src/foo/`).

**Outputs.** Structured Markdown findings document:
- **Relevant files** — list with one-line purpose each, cited `path:line`
- **Patterns observed** — coding conventions, framework idioms in play
- **Entry points** — where execution starts for the task at hand
- **Open questions** — things scout couldn't determine read-only

**Behavioral rules (will not).**
- Will NOT write, edit, or run anything
- Will NOT propose solutions or design (architect's job)
- Will NOT speculate beyond what the code shows
- Will NOT summarize without `path:line` citations

**Failure modes to watch (benchmark these).**
- Surfacing irrelevant files (low precision) → tighten task framing in prompt
- Missing key files (low recall) → consider `scout-flow` triple recon
- Hallucinating function names that don't exist → cite-or-die rule in prompt body

---

## Role 2 — `architect`

**Purpose.** Designs the implementation approach given task + scout findings. Produces a file-level change plan, not code.

| Field | Value |
|---|---|
| Tools | `read grep find ls` |
| Tier | architect-grade (reasoning-heavy; first candidate for model upgrade when paid tier lands) |

**Inputs.** Original task. Scout findings (via `$INPUT`). May re-read files to verify scout's claims.

**Outputs.** Approach doc:
- **Goal restated** — one paragraph
- **Files to change** — for each: path, what changes (high level), why
- **New files** — path + purpose
- **Sequencing** — order of operations if non-obvious
- **Risks / alternatives considered** — short

**Behavioral rules (will not).**
- Will NOT write or edit files
- Will NOT run commands
- Will NOT produce code beyond illustrative snippets (≤5 lines) inside the doc
- Will NOT skip the "files to change" enumeration — that's the contract for builder

**Failure modes.**
- Producing code instead of plan (over-eager) → prompt body forbids code blocks >5 lines
- Vague "refactor X" without naming files → schema requires file list
- Designing for the wrong abstraction → mitigated by scout findings as input

**Open question for Sebastian:** keep or merge into scout+builder? Decision: **keep for v1**, revisit after spike if architect adds no measurable lift on Challenge 1.

---

## Role 3 — `builder`

**Purpose.** Implements the approach. Edits files. Does not run tests.

| Field | Value |
|---|---|
| Tools | `read write edit grep find ls` |
| Tier | worker-grade |

**Inputs.** Approach doc from architect (`$INPUT`). Original task (`$ORIGINAL`).

**Outputs.** File edits + brief implementation notes:
- **Files modified** — list of paths
- **Files created** — list of paths
- **Notes** — any deviations from architect's plan and why; anything left for verifier to confirm

**Behavioral rules (will not).**
- Will NOT run `bash` (no test/build/run — verifier's job)
- Will NOT redesign — follow architect's approach; if it can't, surface the conflict in notes and stop, do not improvise
- Will NOT write tests unless task explicitly asks for them

**Failure modes.**
- Drifting from architect's file plan → enforce "files modified" matches plan exactly, deviation requires note
- Missing imports / wiring (the bug integration-verifier was built for) → mitigated downstream by verifier
- Half-applied edits → builder must complete the full plan or fail loudly

---

## Role 4 — `verifier`

**Purpose.** Runs tests and verifies scenarios. Does not edit. Produces verdict.

| Field | Value |
|---|---|
| Tools | `read bash grep find ls` |
| Tier | worker-grade (mechanical; reads test output) |

**Inputs.** Builder's implementation notes (`$INPUT`). Original task. Project test command (from AGENTS.md or task prompt).

**Outputs.** Verdict doc:
- **Verdict** — `PASS` / `FAIL` (single line, machine-parseable)
- **Tests run** — command + summary (counts, file)
- **Failures** — for each: test name, error, suspected cause, file:line
- **Bug ticket** (only if FAIL) — reproducible description routable to debugger or builder

**Behavioral rules (will not).**
- Will NOT edit code (no `write`/`edit` tools — hard gate)
- Will NOT redesign — only reports
- Will NOT mark PASS without actually running tests
- Will NOT swallow failures or summarize them away

**Failure modes.**
- False PASS (didn't actually run, or misread output) → prompt requires copying the literal test command + line count
- Flaky test misclassified as bug → verifier should re-run once on flake-suspect failures

---

## Role 5 — `reviewer`

**Purpose.** Final judgment on whether the diff solves the original task. No code changes, no execution.

| Field | Value |
|---|---|
| Tools | `read bash grep find ls` |
| Tier | critic-grade (reasoning + judgment; second candidate for model upgrade) |

**Inputs.** Verifier's verdict (`$INPUT`). Original task (`$ORIGINAL`). Reads the diff via `git diff` (default `<base>..HEAD` or `--staged`) — same as a human PR review. May `read` specific files if the diff alone is insufficient context.

**Outputs.** Review doc:
- **Decision** — `APPROVE` / `REJECT` (single line)
- **Task fit** — does the implementation actually do what was asked?
- **Quality concerns** — anything builder/verifier missed (security, edge cases, naming)
- **Required changes** (only if REJECT) — concrete list

**Behavioral rules (will not).**
- Will NOT edit or write
- Will use `bash` ONLY for read-only git inspection (`git diff`, `git log`, `git show`) — never to run tests, builds, or any state-changing command
- Will NOT bikeshed — concerns must be actionable, not stylistic preference
- Will NOT auto-approve PASS verdicts without checking task fit (verifier proves tests pass, reviewer proves *the right thing* was built)

**Failure modes.**
- Rubber-stamp on green tests → prompt forces independent task-fit check before reading verdict
- Endless rejection loop → reviewer's `Required changes` must be finite + concrete

---

## Role 6 — `debugger`

**Purpose.** Investigates failures. Reads logs, runs diagnostics, produces root-cause writeup. Does not fix.

| Field | Value |
|---|---|
| Tools | `read bash grep find ls` |
| Tier | critic-grade |

**Inputs.** Bug description (from verifier's bug ticket, or user prompt for ad-hoc debug). Repo state.

**Outputs.** Root-cause doc:
- **Symptom** — what breaks, observable
- **Root cause** — file:line + explanation
- **Why** — chain from cause to symptom
- **Suggested fix** — high-level (builder picks it up next step in `debug-fix` chain)

**Behavioral rules (will not).**
- Will NOT edit code
- Will NOT propose multiple maybe-fixes — pick the one root cause; if multiple causes, list in priority order with evidence
- Will NOT write tests (use bash to read existing ones)

**Failure modes.**
- Stops at symptom without root cause → prompt requires "Why" section
- Premature fix attempt → no `write`/`edit` tools is the gate

---

## Roles deferred (not in v1)

- `senior` — complex implementation w/ judgment. **Decision:** in v1 = builder + model upgrade. Add only if behavioral split is needed beyond model swap.
- `red-team` — adversarial review. Add when audit chain demands it.
- `documenter` — README/docstrings. Add when needed.
- `refactorer` — pure-refactor builder variant. Add only if regular builder produces feature-creep on refactor tasks during spike.
- `planner` — meta-orchestrator role. Out of scope; chain YAML is the planner.

---

## Open items for Sebastian

1. **Tier names.** Using `worker-grade / critic-grade / architect-grade`. OK or rename? Ok!
2. **Bash for verifier+debugger only?** That's the v1 split. Confirm: builder is intentionally locked out of `bash` (test runs delegated to verifier). Trade-off: extra chain step vs cleaner role boundaries. Ok for now!
3. **Architect kept for v1?** Per question 6 above. Confirm before SKILL.md authoring. We can add the architect but i will not run it so much now!
4. **Reviewer sees diff or full files?** v1 = full files (simpler). Could pipe `git diff` via prompt later. Diff should be enough, that is what humans usally do when reviewing PRs!

After sign-off → Phase 1: write 6 SKILL.md files in `pi-roles/`.

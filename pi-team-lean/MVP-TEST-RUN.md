# pi-team-lean — MVP Test Run

First real-world run of pi-team-lean against the **dikta** repo (macOS Swift dictation app). Captured 2026-05-02.

## Setup

- Repo: `~/work/git/dikta` (Swift Package + Xcode project)
- Sprint: 2 stories — `S1-mic-muter-foundation` and `S2-extend-muter-registry`
- Models: qa = `openai-codex/gpt-5.4-mini`, worker = `openai-codex/gpt-5.3-codex`
- test_command: `cd dikta-macos && swift test`

Sprint file: `~/work/git/dikta/dikta-feature-sprint.json`

## Outcome

```
S1-mic-muter-foundation : failed   (acceptance script failed, swift test PASSED)
S2-extend-muter-registry: skipped  (blocked by S1)
```

Worker commit on story branch: `dda8455 feat: micmuter-foundation google meet muter` — code looks correct, tests pass.

## What worked

- **Setup friction was real but small.** Harness refused to start with dirty tree. Had to commit/gitignore artifacts before running. This is correct behavior, but a pre-flight checklist or `--allow-dirty` for known-safe paths (sprint.json, .pi-team-lean/) would smooth onboarding.
- **qa-author finished fast** (~2 min). Wrote a 4.2KB acceptance script.
- **Worker finished in ~7 min** for a multi-file Swift task spanning 4 new files + ViewModel wiring + tests. Reasonable.
- **State file (`.pi-team-lean/sprint-state.json`)** is clean and easy to monitor externally. Good.
- **Branch hygiene** — story branch + staging branch cut from main, no force-pushes, easy to inspect after the fact. Good.
- **`swift test` ran and passed.** Worker's actual code is correct; the gap is purely between QA's literal asserts and the worker's stylistic choices.

## What failed — root cause

**The qa-author over-specified the acceptance script with literal string-match assertions** instead of behavioral checks. Three concrete gaps:

### Gap 1 — deprecated API string
QA required:
```python
assert "activate(ignoringOtherApps: true)" in f
```
Worker chose the modern macOS 14+ API: `app.activate()` (no args). The deprecated form QA demanded would have triggered a compiler warning. **Worker's choice was strictly better, and got penalized for it.**

### Gap 2 — structural assumption about call site
QA parsed `MenuBarViewModel.swift`, extracted the body of `func startRecording`, and asserted that `unmuteAll` appears inside that body's `catch` block:
```python
assert "catch" in start and "unmuteAll" in start
```
Worker put the unmute in a separate handler (line 474) called from the failure path. **Behaviorally identical, syntactically invisible to QA's parser.**

### Gap 3 — magical naming
QA required test method names to contain literal substrings:
```python
assert any(tok in f for tok in ["ordering", "idempotent", "idempotency"])
assert any(tok in f for tok in ["non-nil", "nonNil", "non nil"])
```
Worker covered the same behaviors but named the test methods differently (`testMuteAllInvokesEachMuter`, etc.). **Pure naming arbitrage.**

## The deeper pattern

qa-author is a single LLM call drafting a script with no view of what code will actually be written. To make assertions concrete, it falls back to **predicting exact strings** the worker will produce. When the worker chooses any defensible variation, the assertion misses.

The harness pattern is fundamentally:
> "qa predicts the implementation, worker implements, harness checks they match"

That's structurally fragile. The qa is being asked to do **ahead-of-time integration testing** with no integration target.

## Suggestions for v2

Ranked by impact:

### 1. Bias qa-author toward behavioral / compile-time / runtime checks
The qa prompt should explicitly forbid literal string-matching of identifier names, API calls, or test method names unless the story body pins them. Strong preferences (in order):
1. Run code: build succeeds, tests pass, a smoke binary runs.
2. Type-level: `swift -e 'let _: MicMuter.Type = X.self'` style probe — compile-time existence.
3. Symbol presence via parser: "MicMuter is declared" yes, "the literal string `activate(ignoringOtherApps: true)` exists" no.
4. File existence: fine.

The acceptance script should treat string-match as a code smell.

### 2. Two-pass acceptance (qa-second-pass)
After the worker commits, give qa-author a second LLM call with the **diff** in hand. It can update the acceptance script to match what the worker actually built, as long as the *behavior* still satisfies the story body. This converts the brittle "predict + match" loop into "predict + reconcile + match." Cheap — one extra mini call per story.

### 3. Structured acceptance contract
Instead of a free-form bash script, qa-author produces a typed contract:
```yaml
files:
  - path: dikta-macos/Dikta/MicMuting/MicMuter.swift
    must_declare: ["protocol MicMuter", "struct MuteToken | class MuteToken | typealias MuteToken"]
build:
  command: "cd dikta-macos && swift build"
test:
  command: "cd dikta-macos && swift test"
  must_include_test_class: "MicMutingTests"
```
The harness compiles this to checks. Removes the "I'm freestyling regex in bash" failure mode.

### 4. Loosen the "merge feature → staging" gate
Currently: both `test_command` AND acceptance must pass to merge. Consider a mode where only `test_command` is required and acceptance failures become **warnings** that surface in stdout, with a `--strict` flag for the current behavior. For a thin-slice MVP this would have shipped S1 cleanly and let S2 attempt.

### 5. Story-level QA prompt overrides
Allow the sprint to specify, per story, a `qa_hint` like `"prefer behavioral asserts; avoid string-matching API call names"`. Today the qa prompt is one-size-fits-all. Some stories want strict scaffolding checks (file exists, type signature pinned), others want freedom.

### 6. Better failure observability
The `failure_reason` field is good, but it would help to also persist:
- the full acceptance script (already present, in `.pi-team-lean/acceptance/`)
- the worker's diff (`git diff main...story-branch`)
- the qa-author's reasoning trace, if the upstream model returned one

So a second pass (human or LLM) can see "qa expected X, worker did Y, here's the gap" without re-running anything.

### 7. Post-mortem hook
A `--post-mortem` flag that, on any failure, runs a third LLM call: "qa expected X, worker did Y, swift test passed. Was the worker correct? If yes, suggest acceptance-script edits." Output to stdout. User decides whether to retry.

## Concrete next step for THIS run

The `dikta` worker commit (`dda8455`) is on `pi-team-lean/1777699819488/story-S1-mic-muter-foundation`. `swift test` passes. Manual review + merge is appropriate; the harness was wrong to fail it.

Then: rerun pi-team-lean with a single-story sprint for S2, base branch = main with S1 merged in.

## Files for inspection

- Sprint config: `~/work/git/dikta/dikta-feature-sprint.json`
- Acceptance script: `~/work/git/dikta/.pi-team-lean/acceptance/S1-mic-muter-foundation.sh`
- State file: `~/work/git/dikta/.pi-team-lean/sprint-state.json`
- Worker branch: `pi-team-lean/1777699819488/story-S1-mic-muter-foundation` (commit `dda8455`)

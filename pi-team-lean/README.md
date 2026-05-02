# pi-team-lean

Deterministic TAKT-driven harness for `pi`. Reads a sprint, executes stories one at a time, merges only when both project tests and bash acceptance assertions pass. Two LLM calls per story (qa-author + worker); everything else is git, bash, and exit codes.

## Install

```sh
cd pi-team-lean
npm install
npm run build
npm link
```

## Use

In any git repo with `pi` available on PATH:

```sh
pi-team-lean ./sprint.json
```

Or `pi-team-lean ./sprint.json --cwd /path/to/target/repo`.

## Sprint format (`sprint.json`)

```json
{
  "base_branch": "main",
  "staging_branch": "pi-team-lean/staging-2026-05-02",
  "test_command": "npm test",
  "worker_model": "openai-codex/gpt-5.3-codex",
  "qa_model": "openai-codex/gpt-5.4-mini",
  "stories": [
    {
      "id": "S1",
      "title": "Add ?completed filter to GET /tasks",
      "body": "As an API consumer, I want to filter tasks by completion status so I can see only what's open.",
      "depends_on": [],
      "test_command": "npm test"
    }
  ]
}
```

## Flow

For each story (in `depends_on` topological order):

1. **qa-author** (one LLM call) drafts a bash assertion script → `.pi-team-lean/acceptance/<id>.sh`. Cached; reused on retries.
2. Harness cuts feature branch from staging.
3. **worker** (one LLM call) implements the story and commits on the feature branch.
4. Harness runs the project's `test_command`. Fail → revert, mark `failed`, continue.
5. Harness runs the acceptance script. Fail → revert, mark `failed`, continue.
6. Both pass → harness merges feature → staging (`--no-ff`), marks `merged`.

State is persisted to `.pi-team-lean/sprint-state.json` after every transition. TAKT can read this for retro.

## What's deterministic vs LLM

| Step | Owner |
|---|---|
| Story dispatch order | Harness (topological sort on `depends_on`) |
| Branch cuts, merges, reverts | Harness (`git`) |
| Test execution | Harness (`bash` + exit code) |
| Acceptance scenario authoring | LLM (qa-author, once per story) |
| Acceptance scenario execution | Harness (`bash` + exit code) |
| Code implementation | LLM (worker) |
| Verdict | Harness (test pass AND acceptance pass) |

## Non-goals (v1)

- Container isolation. Runs on host.
- Parallel stories. Sequential only.
- Cross-team coordination, verb routing, mention grammar. Story owns itself.
- Multi-iteration worker retries beyond what pi does inside one invocation.
- Resume mid-sprint. Re-running re-cuts the staging branch unless one with the same name already exists.

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
pi-team-lean ./pi-team-lean-sprint.json
```

Or `pi-team-lean ./pi-team-lean-sprint.json --cwd /path/to/target/repo`.

To run only one story (skips dependency check):
```sh
pi-team-lean ./pi-team-lean-sprint.json --story S2-extend-muter-registry
```

Open the observer automatically in a new right-side tmux pane when starting a run:
```sh
pi-team-lean ./pi-team-lean-sprint.json --cwd /path/to/target/repo --tmux-ui
# or set PI_TEAM_LEAN_TMUX_UI=1 for orchestrator-launched runs
```

Observe a live or completed run manually in the terminal dashboard:
```sh
pi-team-lean tui --cwd /path/to/target/repo
# or pin a run id
pi-team-lean watch --cwd /path/to/target/repo --run staging-2026-05-02
```

**Convention:** name your sprint file `pi-team-lean-sprint.json` and add it to `.gitignore`. Same file, every repo, never tracked.

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
      "repo_path": "api",
      "base_branch": "main",
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
4. Harness runs the story's `test_command` in `repo_path` when set, otherwise in `--cwd`. Fail → revert, mark `failed`, continue.
5. Harness runs the acceptance script. Fail → revert, mark `failed`, continue.
6. Both pass → harness merges feature → staging (`--no-ff`), marks `merged`.

State is persisted to `.pi-team-lean/sprint-state.json` after every transition. TAKT can read this for retro.

A durable event stream is also written to `.pi-team-lean/runs/<runId>/events.jsonl`. The `watch`/`tui` command tails this file plus `sprint-state.json`, so it can attach to a run started by another orchestrator.

`repo_path` is optional and relative to `--cwd`. Use it for wrapper repositories where stories belong to nested git repos. `base_branch` is also optional at story level and overrides the sprint default for that repo. State and artifacts stay under the orchestrator `--cwd`; branch cuts, worker execution, commit detection, tests, acceptance, judging, and merges happen inside the story repo.

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

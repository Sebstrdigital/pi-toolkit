# Multi-Team Agent Harness — Concrete Layout Draft

Status: **draft for review**, not yet implemented.
Companion to: `team-harness-concept.md`.

This document proposes the concrete file layout, file contents, and bootstrap flow for the minimal-trio team shape (1 orchestrator + 1 lead + 1 worker), targeting the pi sandbox as the first test project.

---

## 1. Overall structure

Two layers, both inside pi-toolkit for now:

```
pi-toolkit/
├── harness/                          # SHARED layer — stable agent definitions, prompts, templates
│   ├── agents/
│   │   ├── orchestrator.md
│   │   ├── leads/
│   │   │   └── generic-lead.md
│   │   └── workers/
│   │       └── generic-worker.md
│   ├── expertise/
│   │   └── templates/
│   │       ├── orchestrator.md
│   │       ├── generic-lead.md
│   │       └── generic-worker.md
│   ├── teams/
│   │   └── minimal-trio.yaml
│   ├── vocabulary.md
│   └── README.md
│
└── <project>/.harness/               # PER-PROJECT layer — mutable state for one project
    ├── team.yaml                     # which shape, scope fill-in, model overrides
    ├── expertise/
    │   ├── orchestrator.md
    │   ├── generic-lead.md
    │   └── generic-worker.md
    └── runs/
        └── 2026-04-27T14-30-00/
            ├── till-done.yaml
            ├── chat.log
            └── artifacts/
```

For week 1, `<project>` is the pi sandbox. The same structure replicates into any future project.

---

## 2. Shared layer — `pi-toolkit/harness/`

### 2.1 `agents/orchestrator.md`

```markdown
---
name: orchestrator
tier: orchestrator
model: nemotron-3-super        # reasoning model — plans, doesn't code
expertise: .harness/expertise/orchestrator.md
tools: [delegate, read]
---

# Orchestrator

You are the only agent the human talks to. You think, plan, and delegate.
You never produce final artifacts yourself.

## Your job
1. Receive user requests.
2. Decompose into lead-sized assignments.
3. Delegate to leads using the `delegate` keyword.
4. Track progress via the till-done list.
5. Report back to the user when all till-done items are closed.

## Vocabulary you use
- `delegate <to-lead>: <task>` — assign work to a lead
- `report <to-user>: <summary>` — surface results to the user
- `done: <task-id>` — mark a till-done item complete

## Rules
- You do not write files.
- You do not edit code.
- If a lead fails repeatedly, reassign to another lead, not yourself.
- Read your expertise file at the start of every session and update it before reporting back to the user.
```

### 2.2 `agents/leads/generic-lead.md`

```markdown
---
name: generic-lead
tier: lead
model: minimax-m2.5            # capable mid-tier — decomposes, validates
expertise: .harness/expertise/generic-lead.md
tools: [delegate, read]
reports_to: orchestrator
---

# Generic Lead

You are a tier-2 manager. You receive assignments from the orchestrator and
delegate to workers. You do not produce final artifacts.

## Your job
1. Receive a delegation from the orchestrator.
2. Decompose into worker-sized tasks.
3. Delegate to workers using the `delegate` keyword.
4. Validate worker output before reporting back.
5. Report results to the orchestrator.

## Vocabulary you use
Same as orchestrator: `delegate`, `report`, `done`.

## Rules
- You do not write files unless every assigned worker has failed.
- If a worker fails, retry once, then reassign or escalate to the orchestrator.
- Update your expertise file with patterns you learn about validating this team's output.
```

### 2.3 `agents/workers/generic-worker.md`

```markdown
---
name: generic-worker
tier: worker
model: ling-2.6-flash          # fast coder — does the actual writing
expertise: .harness/expertise/generic-worker.md
scope: <set-at-runtime>            # filled in per project from team.yaml
tools: [read, edit, bash]
reports_to: generic-lead
---

# Generic Worker

You are a tier-3 specialist. You receive a single concrete task from a lead
and produce the artifact.

## Your job
1. Receive a task delegation.
2. Read your expertise file for relevant prior knowledge.
3. Produce the artifact, staying inside your `scope` paths.
4. Report back to the lead with `report` and mark the task `done`.
5. Update your expertise file with anything notable from this task.

## Rules
- You may only read and write files matching your `scope` glob.
- One task at a time. If the task is too big, report back asking for split.
- If you cannot complete, report the blocker — do not silently stall.
```

### 2.4 `expertise/templates/*.md`

Each template is short — a starting point that the project copy will diverge from. Example for `generic-worker.md`:

```markdown
# Generic Worker — Expertise

This file is yours. You write to it. The human does not edit it.

Use it for:
- Patterns you've found that work well in this project
- Conventions specific to this codebase
- Decisions you've made and why
- Open questions to revisit
- Mistakes you've made, so you don't repeat them

## Patterns

(empty)

## Conventions

(empty)

## Decisions

(empty)

## Open questions

(empty)
```

### 2.5 `teams/minimal-trio.yaml`

```yaml
name: minimal-trio
description: One orchestrator, one lead, one worker. Smallest viable team.

agents:
  - role: orchestrator
    definition: agents/orchestrator.md

  - role: ui-lead                       # role name is local to this team shape
    definition: agents/leads/generic-lead.md
    reports_to: orchestrator

  - role: frontend-worker
    definition: agents/workers/generic-worker.md
    reports_to: ui-lead

# Fields the project must fill in during bootstrap:
required_project_config:
  - scopes                              # one glob per worker
  - model                               # which model to run all tiers on
```

### 2.6 `vocabulary.md`

```markdown
# Harness Vocabulary

A small set of information-dense keywords every agent in the harness understands.
Keep this list short. Add words only when they pull weight.

## delegate
Format: `delegate <to-role>: <task>`
Use: orchestrator → lead, lead → worker.
Meaning: assign a single concrete task to the named recipient.

## report
Format: `report <to-role>: <summary>`
Use: worker → lead, lead → orchestrator, orchestrator → user.
Meaning: surface a result, finding, or blocker to the named recipient.

## done
Format: `done: <task-id>`
Use: any agent.
Meaning: a till-done item is complete. Closes the item.

## escalate
Format: `escalate <to-role>: <reason>`
Use: any agent → its parent tier.
Meaning: "I cannot continue without breaking my rules." Halts the task; the recipient must decide what to do (split, change scope, override a rule, abort). Distinct from `report`, which is used for results — including non-blocking failures.
```

### 2.7 `README.md`

Short — just points at `team-harness-concept.md` and `team-harness-layout.md` and explains the shared/per-project split.

---

## 3. Per-project layer — `<project>/.harness/`

### 3.1 `team.yaml`

Filled in manually during bootstrap (week 1). Example for pi sandbox:

```yaml
team_shape: minimal-trio

# Which model each tier runs on. All currently free in pi.
# Tiering principle: reasoning at the top, fast coder at the bottom.
models:
  orchestrator: nemotron-3-super     # reasoning, not coding
  ui-lead: minimax-m2.5              # capable mid-tier (proven in Phase 4 spike)
  frontend-worker: ling-2.6-flash    # fast coder
  # Available alternates: hy3-preview

# Scope globs per worker. Honour-system in week 1 — violations are logged, not blocked.
scopes:
  frontend-worker: "src/**"          # pi-sandbox is small; tighten as projects grow

# Optional per-agent tool overrides go here later.
```

### 3.2 `expertise/`

One markdown file per agent, seeded from `harness/expertise/templates/` on first run. Mutable. Owned by the agent. Never edited by the human.

### 3.3 `runs/<timestamp>/`

One directory per session. Contains:

- `till-done.yaml` — the working list of open tasks for this run
- `chat.log` — orchestrator-visible message stream
- `artifacts/` — anything the workers produced that lives outside the project tree (logs, generated files we don't want committed yet)

Example `till-done.yaml`:

```yaml
run_id: 2026-04-27T14-30-00
user_request: "Add a debug panel to the sandbox UI showing the current model in use"

items:
  - id: t1
    description: "Scaffold debug panel component"
    assigned_to: frontend-worker
    state: open
  - id: t2
    description: "Wire panel into existing layout"
    assigned_to: frontend-worker
    state: open
  - id: t3
    description: "Validate panel renders correctly"
    assigned_to: ui-lead
    state: open
```

Items move through `open → in_progress → done` (or `failed` for surfacing).

---

## 4. Bootstrap flow (manual, week 1)

When pointing the team at a new project for the first time:

1. Create `<project>/.harness/` directory.
2. Copy `harness/teams/minimal-trio.yaml` reference into your head — it tells you what to fill in.
3. Write `<project>/.harness/team.yaml` with `team_shape`, `models`, and `scopes`.
4. For each agent role in the team shape, copy the matching template from `harness/expertise/templates/<agent>.md` to `<project>/.harness/expertise/<role>.md`.
5. Create empty `<project>/.harness/runs/`.

That's it. Future automation: `/harness-init <project>` slash command that runs steps 1–5 interactively.

---

## 5. Run flow (manual, week 1)

The execution model is: **Claude Code is the human's drafting assistant, pi sessions run the agents.** Claude Code does not run the agents itself.

Concretely:

1. Human starts a Claude Code session in pi-toolkit. Claude Code helps draft the orchestrator-bound prompt: pulls together `harness/agents/orchestrator.md`, current `.harness/expertise/orchestrator.md`, `harness/vocabulary.md`, `.harness/team.yaml`, and the user request into one assembled prompt.
2. Human opens a fresh **pi session** with the orchestrator's model (`nemotron-3-super`) and pastes the assembled prompt.
3. Orchestrator emits a till-done list and `delegate ui-lead: <task>` instructions back to the human.
4. Human opens a separate **pi session** with the lead's model (`minimax-m2.5`), pastes the lead system prompt + expertise + delegation.
5. Lead emits `delegate frontend-worker: <subtask>` back to the human.
6. Human opens a **pi session** with the worker's model (`ling-2.6-flash`) inside the worker's git worktree (see §6), pastes worker system prompt + expertise + task.
7. Worker performs the task within `scope`, emits `report ui-lead: <result>` and `done: <task-id>`, and updates its expertise file before reporting.
8. Human relays the `report` back into the lead's pi session. Lead validates, emits its own `report orchestrator: <summary>`, updates its expertise.
9. Human relays back to orchestrator. Orchestrator emits next `delegate` or final `report user: <summary>`.
10. All three expertise files have been updated by the time the last `done:` closes.

This is verbose but honest: the human is the message bus this week. Once the loop is proven, we automate the relay.

**Expertise update timing:** "before reporting back to the next tier up." Future direction is ad-hoc edits as work happens (the way a human would), but the simpler rule sticks for week 1.

---

## 6. Run isolation — git worktree per worker

Decision: **one git worktree per worker per run**, in the project being worked on.

For minimal-trio (one worker), each run creates exactly one worktree:

```
~/work/dev/pi-sandbox-worktrees/<run-id>-frontend-worker/
```

Reasons:
- Clean isolation per run. Aborted or failed runs don't pollute main.
- **Scope-violation logging is mechanical**: after the run, `git diff` against `main` shows every file the worker touched. Anything outside the worker's `scope` glob is a logged violation.
- Multiple workers in future runs each get their own worktree, in parallel, no conflict.

Bookkeeping for week 1: the human creates the worktree before pasting the worker prompt. `<run-id>` matches the `runs/<timestamp>/` directory name in `.harness/`.

Worktree lifecycle:
- Created at start of worker session
- Worker reports `done` → human reviews diff → either merges into a run-specific branch or discards
- Worktree removed after run is closed

---

## 7. First test prompt — pi-sandbox Challenge 3

Pi-sandbox already has benchmarked challenges. **Challenge 1** was used in the Phase 4 `plan-build-review` spike (MiniMax m2.5, 26/27 tests pass). The natural next benchmark for the minimal trio is **Challenge 3: Filtering/Sorting/Pagination API.**

Why Challenge 3:
- Multi-task by nature: filters, sorting, pagination metadata, RFC 5988 Link headers, query-param validation, tests for each. Real delegation surface.
- Existing benchmark: solo Qwen3-30B passed code, hung on `npm test`, Link headers had cosmetic bugs, one self-contradicting test in the suite. Gives us a concrete bar to beat.
- Scoped to `src/**` of pi-sandbox — clean fit for the worker's scope glob.

### Suggested first user request (entered to the orchestrator)

```
Implement filtering, sorting, and pagination on the GET /tasks endpoint of pi-sandbox.

Requirements (from BENCHMARKS.md Challenge 3):
- Query params: status, sort, page, limit
- Validate query params (400 on invalid status values)
- Return pagination metadata: { page, pages, total } in the response body
- Add RFC 5988 Link headers (next, prev, first, last) — do NOT include empty params
- Add tests covering filters, sorting, pagination, validation, combined params, and Link headers
- Existing tests must still pass

Known sandbox quirks to be aware of:
- Tasks have no createdAt field; sort=createdAt should fall back to id with a comment
- BENCHMARKS.md Challenge 3 references one self-contradicting test in the suite — flag it, do not "fix" by relaxing validation

Operate inside the worker's worktree. Update expertise files before reporting back at each tier.
```

Expected delegation shape:
- Orchestrator → lead: "implement Challenge 3, decompose into worker tasks, validate, report back"
- Lead → worker: ~5–7 sub-tasks (validation helper, filter helper, sort helper, paginate helper, Link header builder, tests, integration)
- Worker writes code in worktree; reports each `done`
- Lead runs `npm test` (with timeout, given the known hang issue), validates, reports
- Orchestrator surfaces the final summary plus any scope violations and the test result

This gives us a real signal: did the trio match or beat the Phase 4 single-chain benchmark? If it matches at higher human-relay cost, week 2 work focuses on automating relay. If it produces *better* output (tighter Link headers, catches the contradicting test, clean scope adherence), the tier discipline is paying off.

---

## 8. What's deliberately not in this draft

- Multiple leads or multiple workers per lead — comes after minimal-trio works
- Per-tier model differentiation — comes after one-model baseline works
- Real till-done switching logic (lead reassigning workers, orchestrator switching leads) — comes after the happy path works
- Munin-backed expertise journaling — comes after flat-file expertise works
- `pi-ui` ingress — end-of-week or later
- `/harness-init` automation — after manual bootstrap proves the shape

This draft is intentionally a minimum viable harness. Everything above is a follow-up.

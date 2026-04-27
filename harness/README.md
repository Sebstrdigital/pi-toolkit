# harness/

Multi-team agent harness for pi-toolkit. Implements the three-tier
(orchestrator → lead → worker) team pattern described in
[`../team-harness-concept.md`](../team-harness-concept.md), with the concrete
file layout from [`../team-harness-layout.md`](../team-harness-layout.md).

## Shared vs. per-project split

This directory is the **shared layer** — agent definitions, system prompts,
expertise templates, the team-shape library, and the vocabulary. It is stable
across projects and versioned with pi-toolkit.

Each project the harness is pointed at gets its own **per-project layer** at
`<project>/.harness/` containing:

- `team.yaml` — selected team shape, scope globs, optional model overrides
- `expertise/` — per-agent, project-scoped expertise files (seeded from
  `harness/expertise/templates/` on first run, then mutable and agent-owned)
- `runs/<timestamp>/` — till-done state, chat log, and artifacts per session

## Layout

```
harness/
├── agents/
│   ├── orchestrator.md           # tier-1 agent: thinks, plans, delegates
│   ├── leads/
│   │   └── generic-lead.md       # tier-2 agent: decomposes, validates, delegates
│   └── workers/
│       └── generic-worker.md     # tier-3 agent: writes the artifact
├── expertise/
│   └── templates/                # near-empty starting points for each role
├── teams/
│   └── minimal-trio.yaml         # 1 orchestrator + 1 lead + 1 worker
├── vocabulary.md                 # delegate / report / done / escalate
└── README.md
```

## Bootstrapping a new project (manual, week 1)

1. Create `<project>/.harness/` and `<project>/.harness/expertise/` and `<project>/.harness/runs/`.
2. Pick a team shape from `harness/teams/`. Currently the only option is `minimal-trio`.
3. Write `<project>/.harness/team.yaml`:
   ```yaml
   team_shape: minimal-trio
   models:
     orchestrator: nemotron-3-super
     ui-lead: minimax-m2.5
     frontend-worker: ling-2.6-flash
   scopes:
     frontend-worker: "src/**"
   ```
4. For each role in the team shape, copy the matching template from
   `harness/expertise/templates/<agent>.md` to
   `<project>/.harness/expertise/<role>.md`.

That is the bootstrap. A `/harness-init` automation is a follow-up.

## Run flow (manual, week 1)

The execution model is: **Claude Code is the human's drafting assistant.
Pi sessions run the agents.** See `team-harness-layout.md` §5 for the full
human-relay walkthrough. Each worker run uses a dedicated git worktree of the
target project (§6).

## Vocabulary

Four keywords, defined in [`vocabulary.md`](vocabulary.md):

- `delegate` — assign work down a tier
- `report` — surface results up a tier
- `done` — close a till-done item
- `escalate` — surface a rule conflict that the parent tier must decide

## Status

Week 1 scaffold. Multiple workers per lead, multiple leads, per-tier model
A/B comparison, munin-backed expertise journaling, `pi-ui` orchestrator
ingress, and `/harness-init` automation are deliberate non-goals for this
round — see `team-harness-layout.md` §8.

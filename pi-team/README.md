# pi-team

Pi extension that boots a Dan-style multi-team agent harness from a project's
`.harness/team.yaml`. Companion docs in repo root:

- `team-harness-concept.md` — generic harness pattern
- `team-harness-layout.md` — file layout + per-project state
- `team-harness-plan.md` — phased implementation plan (this extension)

## Status

**Phase 1 (current).** `/team-up` boots a single orchestrator agent and opens
a chat overlay. `@mention` routing, multi-tier boot, roster pane, and
till-done pane land in Phases 2–4.

## Commands

- `/team-up` — boot the harness for `.harness/team.yaml` in the current cwd
- `/team-down` — (Phase 5 stub) tear down a run
- `/team-init` — (Phase 5 stub) interactive bootstrap of `.harness/`

## Install

From the repo root:

    pi install ./pi-team

Then in any project that has a `.harness/team.yaml`:

    cd <project>
    pi
    /team-up

## Layout

    pi-team/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── pi-team.ts        # entry — registers /team-up, /team-down, /team-init
        ├── team-config.ts    # parse .harness/team.yaml
        ├── agent-def.ts      # parse harness/agents/*.md (frontmatter + body)
        ├── agent-process.ts  # spawn pi subprocesses + stream stdout
        └── overlay.ts        # full-screen chat + input pane

# pi-toolkit

A personal Pi setup with on-demand skills, a conflict-safe symlink installer,
and optional delivery tooling. It is source and documentation, not proof of a
particular host's installed or live-ready state.

## Start here

- [Documentation map](docs/README.md) — current guides, retained records, and
  maintenance plans.
- [Lean workflows](docs/lean-workflows.md) — authority, validation, delegation,
  context, Scout, and routing boundaries.
- [Delivery workflow](docs/delivery-workflow.md),
  [execution service](docs/execution-service.md), and
  [one-shot transport](docs/one-shot-transport.md) — delivery compatibility,
  detailed legacy transport limits, and the shared guarded runtime boundary.
- [Maintenance index](docs/maintenance/README.md) — current map, retention
  inventory, historical notices, and [three static documentation diagrams](docs/maintenance/README.md#documentation-diagrams).

The current rule is simple: an understood execution request authorizes ordinary
reversible work and useful task-owned repair; advice or a proposal does not.
Respect explicit limits and exclusions. New behavior, private data, trust,
application control, destructive/outward actions, installation, commit, push,
or publication need applicable authority. A completed worker or green check is
not acceptance; inspect the candidate and report actual checks and gaps.

## What is here

- `agent/AGENTS.md`: global approval, evidence, memory, and writing rules.
- `skills/`: on-demand guidance, including discovery, delivery (Team
  compatibility), Addy six-phase engineering, one-pager, and validation.
- `extensions/delivery-worker/`: default sequential one-shot compatibility
  transport; `extensions/delivery-tmux/`: separately opt-in visible-tmux
  delivery controls.
- `extensions/one-pager/` and `extensions/lean-progress/`: optional
  presentation/progress features. Progress is a projection, not a scheduler.
- `scripts/`: installer helper, one-shot launcher, and optional Addy entry
  point.
- `vendor/`: pinned third-party/reference material with license and provenance.
  The Addy vendor tree is reference-only.
- `AGENTS.override.md`: intentionally empty shielding for this repository's
  Claude-specific context file.

Skills are loaded on demand; invoke one with `/skill:<name> [request]` when
needed. See [Pi's skills documentation](https://pi.dev/docs/latest/skills) for
the host's skill-loading behavior.

## Install

```bash
bash install.sh
```

Default installation creates the core instruction, skill, and
`delivery-worker` symlinks under `~/.pi/agent/`. It is conflict-safe:
pre-existing files or links to different targets are not overwritten. Keep
this checkout in place. Loading a newly installed extension requires a fresh
Pi session or `/reload`; this repository does not perform either.

Optional components require their own approval and explicit installer flag:

```bash
bash install.sh --with-delivery-tmux
bash install.sh --with-one-pager
bash install.sh --with-progress --hide-thinking
```

These options and their boundaries are documented in
[delivery workflow](docs/delivery-workflow.md),
[one-pager](docs/one-pager.md), and [progress](docs/progress.md). The installer
does not merge arbitrary settings. The PDF skill requires Google Chrome at its
standard macOS path; HomeLab validation requires `ssh validation`.

## Choose the smallest useful path

- **Direct:** localized, understood work in the current session.
- **Developer:** one bounded builder with lead inspection.
- **Team:** useful specialist/independent roles when the task warrants them;
  not a required three-role ceremony.
- **Scout:** focused read-only discovery against supplied accessible sources;
  it is not consent to access private data or a substitute for review.

Six-phase guidance is available through `addy-engineering`; it is a
proportionate optional framework over the existing execution boundary, not a
new scheduler. For normal work, keep task context concise, filter large output
before admitting it to context, and preserve raw evidence on disk. See
[lean workflows](docs/lean-workflows.md) and
[native code mode](docs/codemode.md).

## Compatibility and limits

The one-shot transport remains sequential and model-only; its CLI, timeout,
evidence, cancellation, and fixed-grant details are retained in
[one-shot transport](docs/one-shot-transport.md). The opt-in tmux adapter
supports fixed roles and linked-worktree isolation, but same-workspace ownership
remains exclusive; no nested workers or parallel writers share a checkout.
Fixed grants are tool limits, not an OS sandbox. New workers may load
project context while executable extension/MCP discovery remains trust-gated;
saved sessions keep their recorded policy and pins. Exact behavior and source
limits are in [lean workflows](docs/lean-workflows.md) and
[Scout routing](docs/workflows/scout-role-routing.md).

Repository tests use isolated fakes. They do not certify personal installation,
reload, live providers, or release acceptance. Run the relevant checks for a
change; the launcher suite is:

```bash
node --test tests/*.test.ts
```

## History and proposals

Historical setup and delivery records are retained rather than erased. Read
status notices before treating them as current: [Pi fresh start](docs/pi-fresh-start.md),
[day-one handover](docs/handover-day1.md), and
[lean workflow improvements](docs/lean-workflow-improvements.md).

The maintenance plans collect evidence-gated proposals only. They do not
approve new runtime work, settings, installation, cleanup, or diagrams.

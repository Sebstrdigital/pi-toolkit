# pi-toolkit

Minimal personal setup for the pi coding agent.

## Contents

- `agent/AGENTS.md`: global approval, evidence, memory, and writing rules.
- `skills/`: debug, grill-me, zoom-out, duadigital-pdf-maker,
  homelab-validation, discovery, and delivery (the Team compatibility name).
- `agents/`: builder and independent reviewer role prompts.
- `scripts/delivery-agent.ts`: sequential one-shot worker launcher with live progress.
- `extensions/delivery-worker/`: default one-shot coordinator tool and progress widget.
- `extensions/delivery-tmux/`: explicit opt-in visible-tmux delivery controls.
- `vendor/pi-interactive-subagents/`: pinned MIT runtime, fixed roles, and provenance.
- `docs/delivery-workflow.md`: Team roles, Agreement, and execution loop.
- `docs/lean-workflows.md`: Direct/Developer/Team usage, authority, truthful task state and retained follow-ups.
- `AGENTS.override.md`: empty override shielding this repo from its
  Claude-specific context file.

Skills load on demand; zoom-out is explicit-only.
Invoke a skill with `/skill:<name> [request]`.

## Install

```bash
bash install.sh
```

Creates skill, instruction, and `extensions/delivery-worker` symlinks under
`~/.pi/agent/`. Re-running is safe; existing files or links to other targets
are never overwritten. Keep this checkout in place. Restart Pi or use
`/reload` to load the extension. It uses Pi-supplied packages (tested with Pi 1.0.4).

The PDF skill requires Google Chrome at its standard macOS application
path. HomeLab validation requires SSH access via `ssh validation`.

Parent-directory overrides at `~/work/AGENTS.override.md` and
`~/work/git/AGENTS.override.md` are machine-local and not installed by
this script. An override replaces AGENTS.md/CLAUDE.md in its own directory.

## Choose proportionate execution

Pi is a thinking partner, not an automatic Team coordinator. For consequential
uncertainty use `/skill:discovery [question]`: synthesize existing context,
establish the customer decision and inspect evidence before asking about gaps.
Experiments need sufficient-evidence criteria and a proportionate budget;
reconsider blocker relevance and park side quests.

The agent recommends **Direct**, **Developer** or **Team** with a reason; the
user explicitly chooses. Small Direct work is current-agent implementation
with no mandatory files. Developer normally uses one compact approved packet
and parent inspection through the dedicated model-only `developer` tool in
the opt-in tmux adapter. It requires explicit Developer selection and task
approval references, not full Team documents. See [the exact invocation and
limits](docs/lean-workflows.md#standalone-developer-invocation). The default
one-shot fallback remains Team-only; existing Team launch controls are not a
standalone Developer shortcut.

## Team (delivery compatibility entry point)

After explicit Team selection, use `/skill:delivery [request]`. Keep this
installed alias; there is no duplicate Team controller. The lead synthesizes
Brief/Plan/Agreement from the discussion, makes the actual documents available,
and waits for explicit approval of the actual Agreement before delegation.
Selection authorizes preparation only. Templates live under
`skills/delivery/references/templates/`; exact references/revisions and approval
handling are in `skills/delivery/references/authority-and-state.md`.

Ordinary in-scope work after approval needs no repeated permission. Team is
sequential fresh builder -> no-edit validator -> inspection-only reviewer,
with full applicable approved purpose/design/acceptance references supplied
to each role. The lead explicitly accepts on the tested/reviewed revision;
worker completion is never acceptance. Plan rows are authoritative, and any
opt-in todo widget is only a projection, not a scheduler. Keep blocked,
paused, cancelled and abandoned work visible; no invented percentages.
Narrate meaningful findings, decisions, blockers and completion, not every
tool call. Detailed output remains inspectable (default Pi Ctrl+O).
See [the durable lean-workflow guide](docs/lean-workflows.md) for limits and
follow-ups. Install the pinned progress controller and quieter display explicitly
with `bash install.sh --with-progress --hide-thinking`; default installation does
not change settings or load todo. See [pin, limits, backups and rollback](docs/progress.md).
Personal installation/live readiness remain separate lead-owned gates.

With the extension loaded, the coordinator can call `delivery_worker` with
`role`, `project`, `packet`, `output`, and optional `timeout`, but only after
approval of the execution contract. It is model-only and sequential: no
background dispatch, recursive delegation, or concurrent writers. Escape/
operation cancellation and session shutdown abort the owned worker.

The widget shows observed phase/tool activity, monotonic elapsed time,
activity age, provider-reported cumulative tokens including cache usage,
separate compaction usage, and terminal state. Narrow views prioritize role,
state, tokens, and activity age. Usage is pending/unavailable when not reported.
Quiet means only no recent observed activity, not a hang. Tool errors do not
imply worker failure. No thought text, arguments/results, or raw errors are
shown. Completion remains acceptance/review pending.

The CLI emits throttled compact progress on stderr and preserves raw worker
stderr separately. Rendering failures do not change transport outcomes.

The worker launcher requires Node 24+ and pi on PATH, on macOS or Linux.
It uses native TypeScript execution without additional dependencies.

    node scripts/delivery-agent.ts builder \
      --project /absolute/project/root \
      --packet /absolute/task-packet.md \
      --output /absolute/delivery/task-01-builder

Use `reviewer` for independent review. This legacy one-shot transport has no
validator role: Team still needs a separate fresh no-edit validator through an
approved supported mechanism, or that gate is incomplete. The output parent must already
exist; each invocation requires a new output directory. The default
timeout is 1,800 seconds; override it with `--timeout SECONDS`.

The packet must contain approved scope, project rules, the baseline,
acceptance criteria, validation commands, and allowed actions. Reviewer
packets also need the complete task diff and validation evidence. See
`skills/delivery/references/delegation.md`.

Workers use global model/thinking defaults and normal context files.
Trust-gated project resources, extensions, MCP, skills, templates, and
themes are disabled. Supply necessary specialized guidance in the packet.
Context files load regardless of project trust.

The builder has shell and write tools; it is not sandboxed. Scope,
commit, and outward-action restrictions are instructions. The reviewer
has only read, grep, find, and ls tools, but those are not confined to
the project directory.

Each invocation saves its packet, role prompt, complete raw JSONL stdout,
worker stderr, and status. Stdout is captured continuously with write
backpressure; malformed, truncated, or oversized (>8 MiB per record)
protocol evidence fails closed. Normally completed invocations also save `report.md`.
Evidence may contain sensitive data; do not publish it blindly.

Exit codes: 0 for normal transport completion, 1 for failure, 124 for
timeout, and 130 for interruption. Status "completed" does not mean the
task passed acceptance or review. The coordinator checks actual changes,
validation evidence, and the reviewer verdict.

Cancellation attempts to stop the worker process group. Detached child
processes and external services can survive; inspect state and perform
approved teardown before continuing. Failed runs retain evidence and
may have already changed files.

There is no automatic retry, resume, commit, push, or concurrent
implementation. After interruption, reconcile the record with actual
repository state before launching a fresh attempt.

Run launcher tests without model calls:

    node --test tests/*.test.ts

See [the delivery workflow](docs/delivery-workflow.md) for the full plan.

## Opt-in visible tmux delivery

The one-shot tool/CLI above remain the default and fallback, unchanged.
After approval of the installation and execution contract, opt in with:

```bash
bash install.sh --with-delivery-tmux
```

This adds only the delivery adapter symlink, never the generic vendor entry
point; conflicting files/directories/links (including dangling links) are
refused without overwrite. No settings are changed. Keep this checkout in
place and reload Pi. Do not enable another extension exposing `subagent`,
`subagent_message`, `subagents_list`, or `developer`: collisions refuse delivery startup
before vendor lifecycle initialization. Controls register at session start,
not during factory loading. Runtime state is isolated from upstream instances.

Use Pi inside tmux with a persistent parent session. For Team the current lead
explicitly runs builder -> validator -> independent reviewer, one worker at a time.
Standalone Developer uses `developer` with a compact approved packet, only the
fixed builder, and the same owned slot, lifecycle and resource restrictions.
Its current-session model/thinking are retained without override fields.
For Team, pass the approved packet as task text, including rules, baseline, exact
checks, permissions, and report contract. Select the current model/thinking or specify
`model` and `thinking`; no tools, cwd override, custom profiles, CLI, or nested
spawning can be granted. Fixed bundled profiles ignore project/global agents.
Builder: read/grep/find/ls/bash/edit/write/ask_question. Validator:
read/grep/find/ls/bash/ask_question. Reviewer: read/grep/find/ls/ask_question.
Only the child-control extension is loaded; extension, MCP, skill, template,
theme, and context-file discovery are denied. These are tool limits, **not an
OS/filesystem sandbox**; bash can change files and inspection paths are not
confined. The packet supplies all required rules/resources explicitly.

Results/questions arrive automatically; do not poll. Explicit inspection is
for reconciliation. Answer with exact name/runId/questionId. `pause` preserves
the owned pane/session and holds the slot; a matching answer does not rearm.
Use `rearm` with explicit new work after inspecting actual changes. `stop` and
the fixed 20-minute per-worker timeout cancel, never succeed. Supported
configured child keyboard interruption preserves the proven interruption
latch; there is no universal third-party abort guarantee. Parent shutdown and
reload close only owned panes, idempotently, without parent-window retiling.
Failed closes remain owned for retry; unresolved saved active state fails closed.

`subagent_message` can resume only adapter-recorded sessions in this lead's
branch, replaying unchanged pinned role, grants, identity, model/thinking,
paths, and resource denials. Missing/old/changed metadata is refused; a generic
name registry is not ownership. Accepted v1 records without workflow provenance
remain legacy Team only. Unknown/malformed provenance fails closed. Developer
follow-up work through `subagent_message` must repeat the original `approvalRef`
and `packetRef`; correlated replies, pause and stop do not grant new work. Saved resume is not a fresh independent review.
A terminal worker frees the slot, **not acceptance**. Inspect retained session,
sidecars, scripts, changes, and exact check evidence; for Team use a fresh validator and
reviewer, bounded fix cycles, then explicit lead acceptance. For standalone
Developer the parent inspects actual changes, checks, outcome fit and owned
resources before explicitly accepting under the compact packet. Evidence can be
sensitive. Notifications are bounded; full artifacts remain on disk. Record
resumable Munin handoffs rather than asking the user to copy prompts.

Repository tests use isolated fake HOME/tmux and the installed loader, never
real panes/providers. Independent review, actual installation/reload and live
acceptance are separate gates; repository checks alone do not certify them.

## Expansion policy

Before building new infrastructure, inspect https://pi.dev/packages for
community alternatives. Preserve approval contracts, independent review,
evidence, cancellation, and clear integration ownership.
The current widget is okay for now; Jev and Hermes work are deferred.

## History

Reset on 2026-10-06. The old toolkit is preserved under
`pre-reset-2026-10`; nothing from it was restored.

See [docs/pi-fresh-start.md](docs/pi-fresh-start.md) for the reconciled plan
and current status.
The current setup keeps default policy thin and discovery, Team and HomeLab
procedures in on-demand skills. Static guidance checks do not prove universal
model behavior or installed release readiness.

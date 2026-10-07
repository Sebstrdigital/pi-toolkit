# Minimal Pi Delivery Workflow

The default one-shot workflow was accepted on 2026-10-06; its progress widget
remains unchanged. Repository-owned tmux integration is explicit opt-in;
independent review, installation/reload, and live acceptance are separate gates.

## Goal

Support everyday delivery: discuss a change, investigate it, approve a
concrete plan, then execute autonomously within that scope.

Use sequential one-shot JSON workers by default, with observed progress in the
coordinator's terminal. An explicitly approved visible-tmux mode is available
through the narrow delivery adapter; the current session still coordinates.

## Roles and resources

### Planner/coordinator

The main pi session remains the user's point of contact.

An on-demand delivery skill guides it to:
- Investigate before planning.
- Clarify requirements and expose unresolved decisions.
- Obtain approval for the execution contract.
- Delegate implementation and independent review.
- Evaluate evidence, manage bounded retries, and escalate.
- Present the final handoff.

The coordinator owns the plan and integration decisions. It does not
normally implement application code itself.

### Builder

A separate pi process receives a builder role prompt and an approved task.

It implements only that task, runs the agreed checks, and reports:
- Changes made and files affected.
- Validation commands, results, and relevant output.
- Remaining risks, blockers, and unresolved questions.

It must not expand scope, push, publish, or alter unrelated work.
Commit permission must be explicit in the execution contract.

### Reviewer

A separate pi process receives a reviewer role prompt, the approved task,
the diff, and validation evidence.

It independently checks correctness, scope, project conventions, and
test coverage. It reports blocking findings separately from suggestions.

It does not edit files or fix its own findings. Provide inspection tools
only; the coordinator supplies the diff without granting shell access.

Role-specific skills may be added later when a reusable workflow proves
useful. Do not create skills merely to mirror the role names.

## Planning contract

Before starting execution, record and obtain approval for:
1. Outcome, scope, and non-goals.
2. Investigated code paths and applicable project rules.
3. Ordered tasks and dependencies.
4. Acceptance criteria and exact validation commands.
5. Allowed file changes, environment actions, and commit permissions.
6. Known risks, unresolved questions, and stop conditions.

The user reviews the actual contract, not only a high-level summary.
Material changes require renewed approval.

## Execution loop

1. Investigate and draft the contract.
2. Obtain explicit approval to execute.
3. Run a fresh builder for the next dependency-ready task.
4. Check its report and inspect the actual changes.
5. Run an independent reviewer.
6. For blocking findings, understand the failure and delegate a focused fix.
7. Re-run affected checks and review the revised change.
8. Continue to the next task only after its gates pass.
9. Run final integrated validation and present the human handoff.

Allow at most two fix cycles per task after the initial implementation.
If blockers remain, stop and ask the user rather than retry indefinitely.

Suggestions do not authorize extra implementation.

## First implementation boundaries

- One builder at a time, working in the current project checkout.
- No parallel writers, recursive delegation, or automatic worktrees.
- Fresh worker contexts; use the configured GPT-6.1 Sol model initially.
- Explicitly pass the approved task and relevant project rules.
- Record a baseline of existing changes before execution.
- Preserve unrelated changes; never use blanket staging or cleanup.
- Keep task status and evidence in a project-local delivery record.
- Never silently treat an incomplete or invalid worker report as success.
- Push, PR creation, publishing, and destructive cleanup require approval.
- Arrange approved teardown for temporary validation environments.

Fresh contexts and role instructions are not filesystem sandboxes.
Document actual tool restrictions and any remaining enforcement gaps.

## Implemented toolkit files

- `skills/delivery/SKILL.md`: planning and coordination workflow.
- `agents/builder.md`: implementation role prompt.
- `agents/reviewer.md`: independent review role prompt.
- `skills/delivery/references/delegation.md`: task and report contracts.
- `scripts/delivery-agent.ts`: native Node one-shot launcher, also usable via CLI.
- `scripts/worker-progress.ts`: bounded byte framing and observed progress reducer.
- `extensions/delivery-worker/`: model-only sequential coordinator tool with
  an above-editor widget, installed by `install.sh`.

Do not imply native agent discovery: these role prompts must be loaded
explicitly by the chosen launch mechanism.

## Original implementation sequence

1. Draft and approve the delivery skill, role prompts, and contracts.
2. Verify pi's worker launch and result-handling interfaces.
3. Propose the smallest sequential execution mechanism.
4. Implement and test failures, retries, interruption, and scope boundaries.
5. Exercise it on one small real change and refine from evidence.

An interrupted run must require checking task status and actual repository
state before continuing. It must not blindly replay implementation.

## Observed worker progress

After approval, the coordinator may call `delivery_worker` with the approved
role, project root, packet path, fresh output directory, and optional timeout.
The tool waits for transport completion; it does not dispatch background work.
Workers still use `--no-extensions` and the role-specific tool allowlists.
The standalone CLI needs no runtime Pi package imports.

The compact two-line widget shows role, terminal/running/finalizing state,
monotonic elapsed time, observed activity/tool names, cumulative response
usage (input/output/cache), separate compaction usage, and activity age.
At narrow widths detail is omitted, never wrapped beyond terminal width.
Usage snapshots replace current-response usage and finalized messages
reconcile it. Turn/agent events do not add usage again. Retry waiting is an
observed event, not an inferred testing/implementation phase. Silence means
no activity observed; neither silence nor tool errors prove terminal failure.
Thought text, tool arguments/results, and raw errors stay out of the widget.

Settlement before process close is finalizing, not completed. Completion
requires exit 0, settled protocol, and a valid final report. Even then,
`task_accepted` is false and acceptance/review is pending. Inspect full raw
stdout, worker stderr, status, report, and changes before proceeding.
Rendering errors do not change transport outcomes. Cancellation/shutdown
abort the owned process group and dispose timers/widget ownership; detached
processes and external services can survive and still need approved teardown.

Recorded final validation passed 40 tests using fake workers, a controlled
widget harness, and the installed Pi extension loader without model calls.
Independent review approved the feature. These tests are not a real terminal
smoke test. The user's subsequent feedback is that the widget is okay for now;
no further widget work is planned.

## Explicit opt-in visible tmux mode

Install only after approval: `bash install.sh --with-delivery-tmux`, then reload
Pi inside tmux. Default installation and the one-shot fallback stay unchanged.
The installer refuses conflicting files, directories and links (including
broken links), and never edits settings. Keep the checkout in place. Never
install the vendor's generic entry point. Existing control-name collisions
refuse adapter startup before vendor ownership/abort/reload initialization.

The current lead runs one builder -> one validator -> one independent reviewer.
Use only `subagent`, `subagent_message`, `subagents_list`, registered model-only
and sequentially at session startup. A synchronous reservation prevents sibling
launches; running/paused/waiting states retain the slot. Terminal completion
allows another role, not automatic acceptance or automatic scheduling.

Fixed bundled roles ignore project/global profiles. Builder grants are
read/grep/find/ls/bash/edit/write/ask_question; validator grants are
read/grep/find/ls/bash/ask_question; reviewer grants are read/grep/find/ls/
ask_question. Only child control loads, with extensions/MCP/skills/templates/
themes/context discovery denied. Supply applicable rules and resources in the
packet. Model/thinking selection is permitted without grants widening; cwd is
the current project. No generic launch command, custom agents, alternate CLI,
nesting or parallel writers. These limits are not an OS/filesystem sandbox:
bash can mutate files and inspection tools are not path-confined.

Reports and correlated questions arrive automatically, not through lead polling.
Answer using exact name/runId/questionId. Pause preserves the owned pane/session;
a matching reply releases waiting but not the interruption latch. Reconcile
files/evidence, then rearm with explicit new work. Stop and the fixed 20-minute
per-worker trial timeout cancel and never report success. Supported configured
child keyboard interruption is covered; arbitrary third-party aborts are not.
Shutdown/reload closes only owned panes and retries failed closes, idempotently;
no automatic parent-window retile. Reload state is isolated from other upstream
installations. A crash can leave unresolved ownership: fail closed, reconcile,
and obtain approval before destructive cleanup rather than assuming exit.

Saved resume is restricted to versioned adapter ownership in this lead's branch
and unchanged pinned role/tools/model/thinking/identity/paths/resource denials.
Old/malformed/changed metadata and external registry adoption are refused.
Saved follow-up is not independent review. Inspect sessions, sidecars, scripts,
actual changes and exact command results; bounded notifications are not the full
evidence. Evidence may be sensitive. Keep at most two focused fix cycles and
fresh independent re-review. The lead alone explicitly accepts after all gates
and owned-resource reconciliation; worker completion never accepts the task.

Use Munin recall/remember under the git-root name for decisions, outcomes and
resumable handoffs (task/attempt, approval, revision/evidence, owned resources,
remaining gates, next action; no secrets). Do not ask users to copy worker
prompts. Portable repository tests use fake HOME/tmux and the installed loader,
not live panes/provider workers; live acceptance remains a separate gate.

## References

- Installed pi docs: `cli.md` and `skills.md`.
- Existing Claude orchestrator:
  `~/.claude/skills/orchestrator/SKILL.md`.
- Existing TAKT orchestration:
  `~/.claude/lib/takt/run.md`.
- Community package catalog (inspect before expansion):
  https://pi.dev/packages
- Interactive execution candidate:
  https://github.com/amosblomqvist/pi-interactive-subagents

The selected runtime is pinned and narrowly vendored; accepted corrections,
startup ownership correction, integration deltas and hashes are documented in
`vendor/pi-interactive-subagents/PROVENANCE.md`. This does not imply an OS
sandbox, universal abort guarantee, or broader upstream security certification.

# Explicit Team workflow (delivery compatibility APIs)

The default one-shot workflow was accepted on 2026-10-06; its progress widget
remains unchanged. Repository-owned tmux integration is explicit opt-in;
independent review, installation/reload, and live acceptance are separate gates.

## Goal

Pi is a thinking partner first. Use the discovery skill on demand for consequential uncertainty; synthesize existing discussion/evidence and ask only about consequential gaps. Define experiments by decision, sufficient evidence and budget; reconsider blockers and park side quests. Recommend Direct/Developer/Team with a reason and wait for the user's explicit choice. Small Direct work needs no mandatory files; Developer normally one compact approved packet and parent inspection, through the dedicated opt-in tmux `developer` tool documented in `docs/lean-workflows.md`. Never bypass existing Team launch controls.

For substantial selected Team work, synthesize Brief/Plan/Agreement and approve the actual Agreement before launching. The current session remains lead. Team means sequential fresh builder -> no-edit validator -> inspection-only reviewer. Explicitly approved visible tmux supports these fixed roles. The legacy default one-shot builder/reviewer transport remains available, but has no validator role: supply a separate fresh no-edit validator through an approved supported mechanism or leave that Team gate incomplete. No tool renaming changes authority.

## Roles and resources

### Planner/coordinator

The main pi session remains the user's point of contact.

The on-demand `delivery` skill remains the single user-facing Team compatibility entry point, not an automatic coordinator or duplicate controller. It guides the lead to:
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

It independently checks approved customer-outcome fit and design intent as well as correctness, scope, project conventions and test coverage. Supply full applicable purpose/motivation/design/acceptance references and exact revisions to builder, no-edit validator and reviewer explicitly; denied child discovery cannot load them. It reports blocking findings separately from suggestions.

It does not edit files or fix its own findings. Provide inspection tools
only; the coordinator supplies the diff without granting shell access.

Role-specific skills may be added later when a reusable workflow proves
useful. Do not create skills merely to mirror the role names.

## Brief, Plan and Agreement

Use `skills/delivery/references/templates/{brief,plan,agreement}.md` from the repo root. Brief preserves customer purpose, motivation, intended behavior, chosen-design reasons, evidence, scope/exclusions and observable acceptance. Plan supplies approach, bounded tasks/dependencies, exact checks, budgets, decisions and authoritative task rows. Agreement references exact approved Brief/Plan revisions and establishes execution authority. Long discovery may save a draft Brief early; it is not launch approval.

Selection of Team permits preparation only. Synthesize documents from discussion, not another questionnaire. Provide a concise approval summary with the actual artifacts available; obtain explicit approval of the actual Agreement before execution. Record the exact approval and immutable content hashes or source revisions. Freeze approved scope separately from status annotations; reconcile stale references before launch. Ordinary approved edits, checks and bounded debugging do not require repeated prompts, while material purpose/scope/design/acceptance/permission/budget changes need renewed approval. See `skills/delivery/references/authority-and-state.md` for the full reference contract.

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

1. Investigate, recommend a path, and after explicit Team selection draft Brief/Plan/Agreement.
2. Obtain explicit approval of the actual Agreement and exact referenced inputs.
3. Run a fresh builder for the next dependency-ready task in the approved workspace.
4. Check its report and inspect the actual changes; run a fresh no-edit validator on the same source revision.
5. Run a fresh independent inspection-only reviewer with full purpose/design/acceptance references and complete task-owned diff including added files.
6. For blocking findings, understand the failure and delegate a focused fix.
7. Re-run affected checks and review the revised change.
8. Continue to the next task only after its gates pass.
9. Run final integrated validation and present the human handoff.

Allow at most two fix cycles per task after the initial implementation.
If blockers remain, stop and ask the user rather than retry indefinitely.

Suggestions do not authorize extra implementation.

## First implementation boundaries

- One builder at a time, working only in the explicitly approved workspace; isolate staging when installed symlinks would expose unfinished changes.
- No parallel writers, recursive delegation, or automatic worktrees.
- Fresh worker contexts; use the configured GPT-6.1 Sol model initially.
- Explicitly pass the approved task and relevant project rules.
- Record a baseline of existing changes before execution.
- Preserve unrelated changes; never use blanket staging or cleanup.
- Keep task status and evidence in the agreed project-local record. The Plan is authoritative: pending, active, blocked, paused, cancelled, abandoned or accepted, with evidence/source revision and explicit lead acceptance. Retain unresolved work across retries/resume; no invented percentages.
- The opt-in pinned todo widget is only a projection, not another scope controller. Only accepted maps to completed; label blocked/paused/cancelled/abandoned explicitly. See `docs/progress.md` for the reviewed pin, installation and supported persistence limits.
- Narrate meaningful findings, decisions, blockers and completion, not every tool call; detailed output remains inspectable with default Pi Ctrl+O.
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
smoke test. The user's subsequent feedback was that this observed-worker widget is okay for now. It is distinct from the opt-in Plan projection; observed worker transport still does not confer acceptance.

## Explicit opt-in visible tmux mode

Install only after approval: `bash install.sh --with-delivery-tmux`, then reload
Pi inside tmux. Default installation and the one-shot fallback stay unchanged.
The installer refuses conflicting files, directories and links (including
broken links), and never edits settings. Keep the checkout in place. Never
install the vendor's generic entry point. Existing control-name collisions
refuse adapter startup before vendor ownership/abort/reload initialization.

For Team the current lead runs one builder -> one validator -> one independent reviewer.
Use `subagent`, `subagent_message`, `subagents_list`, registered model-only
and sequentially at session startup. The separate `developer` tool launches only
an explicitly approved standalone builder using the same runtime and slot;
see the lean guide for its packet/approval contract, not a Team gate shortcut. A synchronous reservation prevents sibling
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

## Durable usage and follow-ups

See `docs/lean-workflows.md` for Direct/Developer/Team authority and the full retained follow-up list. Installation/rollback readiness, live behavior demonstrations and lead acceptance are later gates; static checks demonstrate structure only. No OS-sandbox or universal model-compliance guarantee is made.

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

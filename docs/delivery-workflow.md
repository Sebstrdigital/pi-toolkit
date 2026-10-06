# Minimal Pi Delivery Workflow

Status: implemented and accepted on 2026-10-06. The user considers the
installed progress widget okay for now. Further expansion is deferred.

## Goal

Support everyday delivery: discuss a change, investigate it, approve a
concrete plan, then execute autonomously within that scope.

Use sequential one-shot JSON workers with observed progress in the
coordinator's terminal. Interactive worker terminals/background dispatch
remain deferred until the planning contract and quality gates work on real tasks.

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

## Later: interactive subagents

Before building more subagent infrastructure, inspect https://pi.dev/packages
for current community extensions. A community subagent extension may be a
better fit than expanding the custom launcher. No package has been selected.

pi-interactive-subagents is an existing candidate for visible tmux workers,
asynchronous dispatch, parent questions, and explicitly bounded nesting;
compare it with current catalog alternatives before deciding.

Keep the same roles and contracts. Audit isolation, cancellation, resume,
and integration ownership before enabling concurrent implementation.

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

The existing workflows and candidate README were inspected.
The candidate implementation and TAKT runner have not yet been audited.

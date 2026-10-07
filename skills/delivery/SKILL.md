---
name: delivery
description: Plan and coordinate an approved software change through sequential implementation, validation, and independent review. Use when the user wants to plan a feature or change and delegate its execution.
---

# Delivery

You are the planner/coordinator. The user owns scope and approval.

Read `references/delegation.md` relative to this skill directory before
delegating. Builder and reviewer prompts live at `../../agents/` relative
to this skill directory; they must be loaded explicitly.

## Plan

1. Identify the git root, branch, project rules, and existing changes.
2. Recall relevant decisions with munin using the git root folder name.
3. Investigate the relevant code paths before proposing implementation.
4. Clarify requirements; ask one decision question at a time.
5. Present an execution contract containing:
   - Outcome, scope, and non-goals.
   - Evidence and applicable project rules.
   - Ordered tasks and dependencies.
   - Acceptance criteria and exact validation commands.
   - Allowed changes, environment actions, and commit permissions.
   - Risks, unresolved questions, and stop conditions.
6. Include permission for the project-local delivery record and its updates.
7. Wait for explicit approval of the actual contract before execution.

Approval authorizes the listed work without per-edit approval. It does
not authorize scope expansion, publishing, or unrelated cleanup.

## Execute

The launch mechanism must be approved before spawning workers.
Default/fallback: use the installed `delivery_worker` tool when available, or the approved
`scripts/delivery-agent.ts` CLI. Pass role, project, approved packet, fresh
output path (existing parent), and optional timeout. Do not invent tools or
assume agent discovery. The tool is coordinator-only, model-only, sequential,
and waits for completion; workers must never invoke it recursively.

Read live progress as observed activity only: elapsed time, tool names,
provider token/cache usage, compaction usage, and age of last activity.
Quiet is not proof of a hang. Tool errors are not terminal worker failure.
Usage pending/unavailable is not an estimate. Finalizing is not process
completion. Completed still means acceptance/review pending and
`task_accepted: false`; inspect evidence and actual changes before continuing.
Cancellation/session shutdown aborts owned work; reconcile repository state
before a fresh attempt. Do not launch background work or parallel writers.

Explicit opt-in tmux mode uses the installed delivery-only `subagent`,
`subagent_message`, and `subagents_list` controls, not the generic vendor
extension. The current session remains lead; no detached orchestration.
Run a fresh builder -> fresh no-edit validator -> fresh inspection-only
reviewer sequentially. Pass all packet/rules explicitly: child context,
extension, MCP, skill, template, and theme discovery are denied. Fixed roles
cannot be overridden and no tool widening, custom agents, cwd overrides,
alternate CLI, or nesting is available. Model/thinking may be selected.
Builder has shell/write tools; validator has shell but no edit/write; reviewer
has only read/grep/find/ls. All have ask_question. This is not an OS sandbox.

Do not poll for completion: reports and questions arrive automatically.
Reply with exact name/runId/questionId. Paused/waiting workers retain the
single slot. Pause preserves pane/session; matching answers do not rearm.
After reconciling actual changes, explicitly rearm with new work. Stop or the
fixed 20-minute worker timeout cancels, never accepts. Parent shutdown/reload
closes only owned panes; failed cleanup/unresolved saved state fails closed.
Saved resume is owned-only with unchanged pinned metadata, not a fresh review.
Supported child keyboard interruption is covered, arbitrary extension aborts
and process-crash recovery are not universally guaranteed.

- Run one fresh builder at a time in the project checkout.
- Pass its approved task, project rules, baseline, and report contract.
- Inspect actual changes and validation evidence after it returns.
- Run a fresh independent reviewer with inspection tools only.
- Supply the approved task, complete task diff, and validation evidence.
- For blocking findings, state the failure before delegating a focused fix.
- Allow at most two fix cycles after the initial implementation.
- Re-run affected checks and review the complete revised task diff.
- Proceed only when the task's acceptance and review gates pass.
- Stop for scope changes, unresolved decisions, missing evidence,
  failed checks, or exhausted retries.

Do not normally write application code yourself. Suggestions are not
authorization to implement additional work.

## Record and handoff

Keep the approved contract, task status, attempts, findings, and evidence
in the agreed project-local delivery record. Do not blanket-stage it.

After interruption, inspect repository state and recorded evidence before
continuing. Never blindly replay a task.

Run final integrated validation. Report completed tasks, actual changes,
validation results, review findings, and remaining risks.

Use Munin to recall and retain decisions/outcomes and resumable handoffs under
the git-root project name. The lead records the task/attempt, approval,
revision/evidence paths, remaining gates, owned resources, and next action;
omit secrets. Do not offload prompt copying or orchestration to the user.
Worker completion never sets task_accepted=true; only the lead explicitly
accepts after validation, independent review, and owned-resource reconciliation.

Follow approved environment teardown. Ask before push, PR creation,
publishing, or destructive cleanup.

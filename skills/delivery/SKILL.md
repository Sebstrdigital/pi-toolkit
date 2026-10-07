---
name: delivery
description: Prepare Brief/Plan/Agreement and coordinate sequential implementation, validation and independent review for explicitly selected Team work. The delivery name remains a compatibility entry point; never select Team automatically.
---

# Team (delivery compatibility skill)

You are the lead only for explicitly selected Team work. The user owns scope and approval. Recommend Direct, Developer or Team with a reason first; user selection is required. Small Direct work needs no mandatory files. Developer normally needs one compact approved packet and the dedicated tmux `developer` invocation documented in `../../docs/lean-workflows.md`; existing Team launch controls must not be relabeled or bypassed. This skill remains the single Team controller under the supported internal name `delivery`, not a duplicate Team skill.

Read `references/delegation.md` relative to this skill directory before
delegating. Builder and reviewer prompts live at `../../agents/` relative
to this skill directory; they must be loaded explicitly.

## Prepare purpose-preserving documents

Selection of Team authorizes preparation, not implementation. Identify the git root, branch, project rules and existing changes; recall relevant decisions with Munin. Inspect relevant paths and synthesize the prior discussion/evidence. Ask only about consequential gaps, one decision at a time; do not repeat the discussion as a questionnaire. Long discovery may save an unapproved draft Brief early.

Use the reusable templates in `references/templates/brief.md`, `references/templates/plan.md` and `references/templates/agreement.md`. Read `references/authority-and-state.md` for revisions, approvals and task-state handling.

- **Brief:** customer problem, motivation, intended behavior, design reasoning, evidence, acceptance outcomes, scope and exclusions.
- **Plan:** chosen approach, bounded ordered tasks/dependencies, exact validation, budgets, decisions and authoritative task rows with revision/evidence links.
- **Agreement:** exact approved Brief/Plan references, execution permissions, allowed files/resources, launch mechanism, commit/installation/cleanup authority, stop conditions and budgets. Include permission for the project-local record and lead updates.

Present an understandable approval summary and make the actual Agreement and referenced Brief/Plan available. Wait for explicit approval of the actual Agreement before launching. Record the exact approval and immutable approved revisions/source references. A summary, draft or Team selection alone is not execution approval. Keep approved scope separate from progress annotations; material purpose/scope/design/permission/budget changes need renewed approval.

Approval authorizes ordinary listed edits, checks and bounded debugging without per-edit approval. It does not authorize expansion, publishing or unrelated cleanup. Stop at genuine authority, evidence, ownership, consequential decision or budget boundaries.

## Execute

The launch mechanism must be approved before spawning workers.
Preferred Team mechanism: explicitly approved visible tmux with fresh builder -> no-edit validator -> inspection-only reviewer. Legacy default/fallback: use the installed `delivery_worker` tool when available, or the approved
`scripts/delivery-agent.ts` CLI. Its builder/reviewer transport has no validator role; the lead must supply a separate fresh no-edit validator through an approved supported mechanism, or stop with that Team gate incomplete. Fallback availability does not waive validation or grant a standalone Developer path. Pass role, project, approved packet, fresh
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

Explicit opt-in Team tmux mode uses the Team-only `subagent` launch and
`subagents_list` inspection, with shared owned `subagent_message` control,
not the generic vendor extension. The separate standalone `developer` tool
shares that same slot; it is not authority to bypass Team's gates. The current session remains lead; no detached orchestration.
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

- Run one fresh builder at a time in the explicitly approved workspace; isolate staging when installed symlinks would expose unfinished source.
- Pass its approved task, full applicable Brief/design/Agreement references with exact revisions, project rules, baseline, and report contract. Children cannot discover these automatically.
- Inspect actual changes and validation evidence after it returns.
- Run a fresh no-edit validator on the same revision, then a fresh independent reviewer with inspection tools only.
- Supply each with full applicable purpose/design/acceptance references, the approved task, complete task diff (including added files), source hashes and validation evidence. Review customer-outcome fit as well as correctness.
- For blocking findings, state the failure before delegating a focused fix.
- Allow at most two fix cycles after the initial implementation.
- Re-run affected checks and review the complete revised task diff.
- Proceed only when the task's acceptance and review gates pass.
- Stop for scope changes, unresolved decisions, missing evidence,
  failed checks, or exhausted retries.

Do not normally write application code yourself. Suggestions are not
authorization to implement additional work.

## Record and handoff

Keep the approved Brief/Plan/Agreement, task status, attempts, findings and evidence in the agreed project-local record. Do not blanket-stage it. The Plan task rows are authoritative: pending, active, blocked, paused, cancelled, abandoned or accepted. Retain unresolved work and evidence/revision links; no invented percentages. The opt-in todo widget is only a projection, not a scheduler or independent acceptance system. Narrate meaningful findings, decisions, blockers and completion; keep detailed output inspectable.

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

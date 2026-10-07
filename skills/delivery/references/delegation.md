# Team delegation contract (stable delivery APIs)

Read `authority-and-state.md` for approval/revision and authoritative Plan rules. Team is explicitly selected; the actual Agreement and exact referenced Brief/Plan must be approved before launch. The user-facing name does not change internal APIs or authorize Developer through delivery-only controls. Standalone Developer uses only the dedicated `developer` tool from the same opt-in tmux adapter, with explicit Developer selection and approved compact packet references; see `../../../docs/lean-workflows.md` relative to this reference directory for the exact invocation. It shares Team ownership/control, not Team launch authority; no full Team documents are required.

## Builder packet

- Task ID and attempt number.
- Explicit statement that the user approved this task's execution.
- Full applicable approved Brief purpose, motivation, design reasoning, experiment evidence and acceptance outcomes, with exact paths/revisions/hashes and identified readers. Supply accessible text or absolute paths explicitly; denied child discovery cannot load them for you.
- Outcome, scope, non-goals, and acceptance criteria tied to those references.
- Relevant code paths, investigation evidence, and project rules.
- Completed dependencies and relevant prior decisions.
- Git root, branch, and baseline of pre-existing changes.
- Allowed modifications and prohibited actions.
- Exact validation commands and environment requirements.
- Commit permission: none unless explicitly granted.
- Stop conditions and builder report format.

Provide enough context to work independently; do not copy the entire
planning conversation or include unrelated tasks.

## Validator packet

- Approved task, full applicable Brief/design/Agreement references with exact revisions, project rules and acceptance outcomes.
- Baseline, complete task-owned diff including added files, actual source revision/hashes and builder evidence.
- Exact checks and allowed environment actions; no edit/write authority (shell is not an OS sandbox).
- Report commands/exits/counts/skips, evidence per criterion, failures and gaps. Missing or unexecuted checks are not passes.

## Reviewer packet

- Approved task and applicable project rules.
- Full applicable approved purpose/design/acceptance references, exact revisions and relevant experiment evidence; inspect outcome fit, not just artifacts or code correctness.
- Baseline identifying the task's starting repository state.
- Complete task diff, including added/untracked task files.
- Relevant builder report and validation evidence.
- Prior findings and fixes when reviewing a revised attempt.
- Reviewer report format.

Separate task changes from pre-existing edits. If that cannot be done
reliably, stop rather than presenting a misleading diff.

## Launch and progress contract

The approved coordinator may use `delivery_worker` (model-only, sequential)
or `node scripts/delivery-agent.ts builder|reviewer --project PATH --packet
PATH --output PATH [--timeout SECONDS]`. Use a new output directory with an
existing parent for each attempt. No background dispatch, recursive delegation,
or parallel writers. Workers retain JSON one-shot mode and role allowlists;
the builder shell/write tools and reviewer inspection paths are not sandboxed.

The above-editor widget and CLI stderr progress show observed metadata only.
Elapsed/activity ages update during silence. Provider cumulative response
usage replaces previous snapshots; final messages reconcile usage without
turn/agent double counting. Compaction is separate and usage may be unavailable.
Do not infer testing/implementation phases, percent complete, hangs, or terminal
failure from tool errors. Thought text, arguments/results, and raw errors belong
only in evidence, not compact progress.

Raw stdout is captured continuously with backpressure and bounded LF record
parsing. Protocol/evidence errors fail closed; rendering errors do not affect
outcome. Cancellation/timeout retains evidence and may leave file changes.
`agent_settled` before process close is finalizing. Exit 0 plus settlement and a
valid final report means transport completion only, never task acceptance.

## Explicit opt-in tmux contract

Default one-shot behavior above is unchanged. Approve the visible mode and
installation separately; `bash install.sh --with-delivery-tmux` adds the narrow
adapter, never the generic upstream entry point. The lead stays in the current
persistent tmux session, launching builder -> validator -> independent reviewer
with the three Team model-only sequential controls. The separate `developer` launch tool shares the same single slot and fixed builder runtime. Do not use it to launch a validator/reviewer or waive Team's independent gates. No automatic role scheduler,
acceptance, parallel workers, nesting, custom/override profiles, or CLI path.

For every phase supply the complete approved packet and explicit role rules.
Builder tools: read/grep/find/ls/bash/edit/write/ask_question; validator:
read/grep/find/ls/bash/ask_question; reviewer: read/grep/find/ls/ask_question.
Only bundled child control loads; six discovery sources (extensions, MCP,
skills, templates, themes, context files) are denied. Neither shell nor file
read access is an OS sandbox. Expose only model/thinking choice, not grants.

Results/questions arrive automatically. Preserve exact correlated run/question
IDs; a reply releases waiting only. Pause preserves pane/session and the slot;
rearm needs explicit new work after reconciliation. Stop and the fixed
20-minute worker timeout classify cancelled. Supported configured child
keyboard interruption is latched; arbitrary third-party aborts are outside the
guarantee. Parent shutdown/reload retries owned-only cleanup, no parent retile.
Failure evidence and failed-close ownership remain; unresolved saved active
workers fail closed rather than being silently adopted or treated as successful.

Saved resume requires this adapter's versioned branch ownership and unchanged
pinned loadout/resource metadata, never an external registry entry. Missing,
legacy, malformed, or altered metadata requires reconciliation/fresh approved
work, not relaxed grants. Saved follow-up does not replace fresh review.
Inspect full sessions, sidecars, launch scripts and exact validation evidence;
notifications are bounded and may omit full reports. Retain evidence securely.

Record Munin handoffs with task/attempt, approved scope, revision, reports/checks,
owned resources, blockers, and next approved action. Omit secrets. The lead owns
handoffs, retries (at most two focused fix cycles), final validation, review and
explicit acceptance; do not ask the user to ferry prompts between roles.

## Coordinator gates

- Verify actual repository changes, not only the builder's summary.
- Match validation evidence to the reviewed revision.
- Treat missing, malformed, interrupted, or ambiguous reports as incomplete.
- A completed builder report is not independent acceptance.
- Require fresh no-edit validation, independent reviewer approval and customer-outcome evidence on the same source revision, then explicit lead acceptance and owned-resource reconciliation before closing a task.
- Maintain pending/active/blocked/paused/cancelled/abandoned/accepted Plan rows with evidence/source revision; the opt-in widget is only a projection. Retain unresolved work; no invented percentages.
- Keep unresolved findings visible across fix cycles.
- After two fix cycles, escalate remaining blockers to the user.

These contracts are instructions, not a filesystem sandbox.
The launch mechanism must enforce tool selection and document its limits.

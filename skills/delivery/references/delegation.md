# Delegation Contract

## Builder packet

- Task ID and attempt number.
- Explicit statement that the user approved this task's execution.
- Outcome, scope, non-goals, and acceptance criteria.
- Relevant code paths, investigation evidence, and project rules.
- Completed dependencies and relevant prior decisions.
- Git root, branch, and baseline of pre-existing changes.
- Allowed modifications and prohibited actions.
- Exact validation commands and environment requirements.
- Commit permission: none unless explicitly granted.
- Stop conditions and builder report format.

Provide enough context to work independently; do not copy the entire
planning conversation or include unrelated tasks.

## Reviewer packet

- Approved task and applicable project rules.
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

## Coordinator gates

- Verify actual repository changes, not only the builder's summary.
- Match validation evidence to the reviewed revision.
- Treat missing, malformed, interrupted, or ambiguous reports as incomplete.
- A completed builder report is not independent acceptance.
- Require acceptance evidence and reviewer approval before closing a task.
- Keep unresolved findings visible across fix cycles.
- After two fix cycles, escalate remaining blockers to the user.

These contracts are instructions, not a filesystem sandbox.
The launch mechanism must enforce tool selection and document its limits.

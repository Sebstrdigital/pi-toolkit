# Authority, revisions and task state

The lead synthesizes documents from the conversation and inspected evidence. Brief preserves purpose and chosen-design reasons; Plan turns that purpose into bounded tasks and evidence; Agreement authorizes execution against exact references. The user explicitly chooses Team and approves the actual Agreement before any worker launch. Offer a concise summary, but never substitute approval of a summary or path selection for actual Agreement approval.

## Revision handling

Give each artifact a revision and identify approved sources by exact path plus content hash or immutable git revision. Record who approved, the exact approval and when, and which Brief/Plan/Agreement revisions it covers. Distinguish draft, proposed and approved. Freeze the approved scope text or keep progress in a separate clearly identified section/record so updates do not silently rewrite approval. Before launching, verify references still match; a stale packet or source mismatch blocks launch until reconciled.

Ordinary authorized edits, checks, debugging and up to the agreed bounded fix cycles do not need repeated user permission. Material changes to customer purpose, acceptance, scope, design trade-offs, authority or budgets require a revised proposal and renewed approval. Discovered facts and status annotations are evidence, not new scope permission. Suggestions go to parked follow-ups. Outward/destructive actions and commits/install/cleanup are permitted only if explicitly included. Preserve unrelated work and retain resumable records on failure/interruption.

Every builder, validator and reviewer must read the full applicable approved purpose/design/acceptance references, not just a task checklist. Identify these readers in the Plan; pass absolute accessible paths or exact supplied text/revisions explicitly because child discovery is denied. Include relevant experiment results, project rules, baseline, allowed workspace, exact checks and source revision. If context is missing, stop and ask the lead. A reviewer assesses approved outcome fit, not merely code correctness or artifact existence.

## Authoritative Plan rows

Use a lightweight Markdown table, not a new JSON framework or scheduler:

| Task | Outcome / dependencies | State | Approved references / source revision | Evidence / blocker / next action | Lead acceptance |
| --- | --- | --- | --- | --- | --- |
| T1 | Observable outcome; none | pending | Brief r1 criterion B1; Agreement r1; base hash | Not launched | Not accepted |

Allowed states:

- **pending:** approved work not started, including dependency waiting.
- **active:** currently executing or awaiting validation/review; transport completion alone does not change acceptance.
- **blocked:** cannot proceed; record the actual blocker and needed decision/evidence.
- **paused:** deliberately suspended; retain ownership, evidence and resume conditions.
- **cancelled:** execution stopped; retain partial changes, resource reconciliation and reason.
- **abandoned:** deliberately no longer pursued; retain rationale and any required scope approval. It is not success.
- **accepted:** lead explicitly inspected actual changes, acceptance evidence, fresh validation and independent review on the same revision, and reconciled owned resources. Record the decision, revision and links.

The lead alone updates acceptance. Worker reports, exit zero, a terminal slot, passing tests or widget completion cannot accept a task. Keep unresolved rows/findings across retries; allow at most two focused fix cycles after initial implementation unless the approved Agreement is stricter. Each cycle needs fresh evidence and complete revised-diff review. Stop when budgets or gates are exhausted; do not turn a missing check into a pass. Reconcile source, evidence, rows and owned resources before resume rather than replaying blindly.

## Opt-in widget projection

Team's durable Plan is authoritative. The pinned @pify/todo 0.3.0 controller is a display/persistence cache only, not another scope controller. It exposes pending/in_progress/completed. Lead-maintained reconciliation maps accepted to completed **only**; active to in_progress; pending to pending. Retain blocked, paused, cancelled and abandoned rows as unresolved pending entries with explicit textual [blocked], [paused], [cancelled] or [abandoned] labels and reasons. Do not drop them to make a finished list; no invented percentages. Filter its bundled scratchpad skill: the installed shim loads only the unchanged controller, never upstream skills or another suite. See `../../../docs/progress.md` for opt-in installation, provenance, supported lifecycle limits and rollback. Loader/mock probes are not live installed readiness.

On supported reload/branch/compaction recovery, rebuild the view from the applicable Plan revision and reconcile differences before displaying acceptance. A stale or missing view is not a source of authority. Meaningful default-agent scratch lists need no mandatory Plan for trivial Direct work. Do not create independent child task systems. Detailed output remains inspectable (Pi's default Ctrl+O); narration is reserved for findings, decisions, blockers and completion. No prompt or static test guarantees universal model compliance.

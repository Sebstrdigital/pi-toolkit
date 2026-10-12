# Machinery improvement plan

> **Proposal register only.** Nothing here authorizes code, settings, package,
> installation, reload, worker launch, data access, commit, or cleanup. Existing
> source capabilities are recorded as implemented and must not be re-proposed.

## Already implemented — retain, measure before changing

- Shared guarded execution service and compatibility adapter:
  [execution service](../execution-service.md).
- Fixed Scout/default-and-strong routing, registry preflight, optional
  assignment, escalation semantics, and linked-worktree ownership:
  [Scout routing](../workflows/scout-role-routing.md) and
  [lean workflows](../lean-workflows.md#concurrency-context-and-runtime-limits).
- Native codemode admission guidance, and progress as an opt-in projection:
  [context backlog](../workflows/context-efficiency-backlog.md),
  [progress](../progress.md).
- One-shot worker transport remains compatibility, not an unused cleanup
  target: [one-shot transport](../one-shot-transport.md).

## Prioritized proposals

| Priority | Proposal and dependency | Acceptance evidence before a separate implementation decision |
| --- | --- | --- |
| P1 | **Reconcile accepted source into a reproducible versioned baseline.** The accepted runtime/docs/tests are currently a dirty/untracked worktree, and observed personal symlinks are not clean-clone reproducibility. First identify intended tracked source, generated evidence boundaries, and an owner. | A clean checkout can identify the accepted source revision, vendor/provenance inputs, installer surface, and required checks without relying on a personal host link or untracked file. No commit is implied by this proposal. Source: housekeeping audit; [retention inventory](retention-inventory.md). |
| P2 | **Define safe derived-cache ignore and retention policy.** Depend on P1's source/evidence classification, reference checks, backup/rollback review, and no active run. | Regenerable compile caches have an explicit ignore/retention disposition; retained evidence remains discoverable and rollback-safe. No blanket deletion/move. Source: [retention inventory](retention-inventory.md). |
| P3 | **Bounded context admission.** Gather normal-task evidence for native codemode; depend on a representative, source-cited sample rather than output-size assumptions. | Same retrieval questions retain exact sources, failures, skips, and truncation while admitting bounded output. Record counts, not claimed token/cost savings. Source: [context backlog](../workflows/context-efficiency-backlog.md). |
| P4 | **Measured routing.** Keep current routing stable while collecting task/outcome evidence; depend on exact registry/effort availability at any future launch. | Compare like tasks with model, effort, inputs/cache/output, launches, repairs, duration, accepted result, and any observable usage-meter change. No default change without that evidence. Source: [native Kokoro retrospective](../workflows/native-kokoro-workflow-retrospective.md). |
| P5 | **Context Mode MCP trial only after P3 reveals a retrieval gap.** Inspect version, data boundary, freshness, capabilities, and Pi integration path first. | Compare it with native codemode on the same large artifacts, including later retrieval and edited/uncommitted sources; count indexing, latency, and all retrieval turns. Explicitly grant capabilities. Source: [context backlog](../workflows/context-efficiency-backlog.md). |

## Parked unless a measured need changes the decision

Billion Context, pi-flow, Jev, Hermes, dashboards, and repository indexing are
not active work. Revisit only with a demonstrated residual problem, a compact
proposal, explicit permission/data boundaries, and an owner. Sources:
[context backlog](../workflows/context-efficiency-backlog.md),
[Pi fresh start](../pi-fresh-start.md), and
[lean workflows](../lean-workflows.md#state-and-evidence).

## Non-goals

Validation envelopes, task sizing, and delegation belong to the workflow plan,
not a new runtime/scheduler. This plan does not alter source behavior, fixed
role grants, installation, settings, current routing, or historical
saved-session policy.

# Lean, outcome-driven workflows

## Authority comes from the task, not the ceremony

A clear user request to execute an understood task authorizes ordinary reversible development: implementation, minimal supporting files, diagnosis, checks, useful repairs and reconciled continuation. A proposal, request for advice or vague readiness is not execution authority. Ask once about genuine consequential gaps; do not require a Direct/Developer/Team selection followed by separate approval of an Agreement.

Recommend an execution approach with a reason when helpful. Direct is current-agent work. Developer is one separate builder with lead inspection. Team uses useful specialist/independent roles; it does not mandate three agents per slice. Respect explicitly requested review/validation gates. Conversation, an issue or existing JSON task state can carry purpose, intended behavior, acceptance and exclusions; records/templates are optional recovery aids, not permission paperwork.

File lists are implementation pointers unless explicitly restricted. Minimal supporting configuration/tests belong to an already authorized outcome; a new filename alone is not a product decision. New behavior, explicit exclusions, privacy/security/trust, ownership, side effects or required-check changes still need a real decision. Existing approvals and declared limits remain binding, including old narrow file lists and repair limits. No retroactive rewriting of active tasks.

## Own completion

The lead owns implement -> diagnose -> in-scope repair -> revalidate/review -> next approved task. Red task-owned checks trigger diagnosis and useful repair, not routine customer stops. Ordinary compiler/test/harness corrections are implementation, not repair tokens. Do not invent repair-count caps, per-role pools or active-minute ledgers. Use a user-agreed cumulative ceiling if requested. Diagnose repeated failures and change strategy; stop for demonstrated no progress or an exhausted explicit limit, not merely another red check.

A replacement is not a development iteration. One diagnosed terminal same-role replacement remains supported; same-worker corrections/resumes do not spend replacement tokens. Reconcile resources, actual partial changes and remaining explicit allowance before recovery. Never blindly replay side effects, reset a declared budget or silently substitute models. Environment failures or missing permission are not model-escalation reasons.

Choose roles and context lifetimes to fit the work. No mandatory fresh builder/validator/reviewer pipeline for every slice. One independent reviewer may assess code and validation evidence; use a separate validator when meaningful or requested. Inspect the complete task-owned diff including added files and realistic behavior, not just artifact compliance. The lead alone accepts; worker completion or a green test is not product acceptance.

Reuse accepted evidence only for unchanged candidate/conditions. Changes invalidate affected checks and downstream assumptions; renew affected checks/review plus required integrated gates, not assurance-only full reruns. Source tracing does not prove an untested runtime/manual scenario. Finish with exact candidate, run/reused evidence, consolidated manual checklist and honest gaps, distinguishing known defects from untested scenarios. Ready for manual validation is not customer acceptance or release permission.

## Validation and data safety

For Direct, Developer and Team, isolate live-side-effect tests and verify the effective execution boundary before sensitive tests run. Invoking shell alone is not proof: confirm effective test-host paths/config/environment with safe preflight. If isolation is unverified or fails, fix setup before proceeding; do not use private/live data to discover whether isolation worked. Honor any required valid baseline before edits; later checks are corrective evidence, not retroactive compliance. Report any breach separately from final product checks. No global application inventory or unrelated-app closure requirement.

State permitted inputs, owned outputs/processes and material effects when they matter. Correct task-owned harnesses within that envelope. New data access, side effects or changed required acceptance/checks need authority. Missing or excluded checks are not passes. Do not stop the application under development or interfere with unrelated apps without applicable permission. No default commit/install/delete/force/push/PR/publication authority; task-scoped disposable test cleanup is governed by its existing permission.

## Standalone Developer invocation

Use the installed dedicated tool with tmux and a persistent parent session (`install.sh --with-delivery-tmux`). A task request supplies authority; selection is optional legacy compatibility metadata, not a question for the customer. The packet can be concise text or the existing structured object:

```javascript
developer({
  approvalRef: "conversation execution request",
  packetRef: "task pointer or request reference",
  packet: "Implement the requested outcome. Preserve exclusions and unrelated work. Read project rules. Run relevant checks and return changed paths, results and gaps.",
  name: "task-builder"
  // cwd: "/absolute/existing-linked-worktree" // optional isolation
})
```

Legacy structured fields purpose/scope/allowedPaths/projectRules/baseline/validation/acceptance/task still work. Text packets must carry the meaningful task context, not just a claimed approval string. References are instruction-based declarations, not authentication of actual user consent. Parent verifies actual authority and source boundaries. Developer remains builder only; use subagent for validator/reviewer. Fixed grants are instructions/tool filters, not an OS sandbox.

Resume with subagent_message using exact owned name, in-scope work and original approvalRef/packetRef; no renewed customer permission is needed. Scout resumes carry original discoveryAuthorityRef. Correlated replies use exact runId/questionId and release waiting, not pause. Pause retains ownership; rearm requires new work. Stop cancels. Saved sessions replay pinned grants/model/identity/resource policy unchanged. Missing/changed sidecars or malformed provenance fail closed; a generic registry is not ownership. Legacy missing-workflow records remain legacy Team only.

## Concurrency, context and runtime limits

Dispatch is serialized so name/lineage/runtime hooks bind to the correct launch. Execution is not globally serial: builder/validator/reviewer/Developer workers can run concurrently in distinct existing linked worktrees of the same repository via cwd. Same-workspace ownership is exclusive, including waits and pauses. No parallel writers in one checkout. Provision an owned worktree with the intended candidate; cwd is not authority to change its outcome or someone else's branch. No automatic merge/force cleanup. Workers do not nest.

Failed surface cleanup, orphaned panes and unresolved saved active workers still require reconciliation. Parent shutdown closes only owned resources; cancellation is not acceptance. New undeclared workers have no arbitrary 20-minute execution stop. Explicit assignment.effortMinutes bounds measured cumulative execution across resumes and one replacement; waiting/paused time does not consume execution but retains ownership. Legacy unbound saved sessions retain their original 20-minute execution bound. Declared records missing execution measurements fail closed. This clock is execution elapsed, not CPU/model or overall task effort. Honor an overall task ceiling if the user actually agreed one; do not manufacture it.

New delivery snapshots use project-context resource policy: project instructions, skills, prompt templates and themes can load. Executable extension and MCP discovery remain denied until a trust/grant mechanism exists; only bundled control and explicitly granted native codemode load. This preserves executable-code trust, not a blanket ban on project context. Legacy snapshots retain six original denials. Child grants cannot widen through codemode, instructions or discovery.

## Scout and routing

Scripts first for deterministic extraction/counting. Scout is read-only supplied-source discovery without Developer or Team selection. Supply discoveryAuthorityRef, focused question, locally accessible sources, relevant rules/exclusions, investigation budget/stopping criteria and cited resultContract. A source path or metadata is not private-data consent. Tools: read/grep/find/ls/codemode/ask_question; no shell, mutation, process control, external web research, nesting or acceptance. Scout findings do not replace requested independent gates. See [routing and escalation API](workflows/scout-role-routing.md).

| Role/task | Default | Strong |
| --- | --- | --- |
| Lead | openai/gpt-6.1-sol, medium | same, high |
| Scout lookup | openai/gpt-6-luna, low | openai/gpt-5.6-terra, medium |
| Scout analysis or omission | openai/gpt-5.6-terra, medium | openai/gpt-6.1-sol, medium |
| Builder / Developer | openai/gpt-5.6-terra, medium | openai/gpt-6.1-sol, high |
| Validator | openai/gpt-5.6-terra, medium | openai/gpt-6.1-sol, high |
| Reviewer | openai/gpt-5.6-terra, high | openai/gpt-6.1-sol, high |

New launches never inherit the parent model. Optional profile: strong selects the configured stronger candidate; Developer uses explicit model/thinking. Developer candidates are Terra/medium or Sol/medium/high. Scout accepts taskKind: lookup or analysis; omission is analysis. Exact available/authenticated registry identity and supported effort are checked before allocation, without silent clamp or parent substitution. Registry metadata does not prove backend entitlement. No Astra, invented 6.1 Terra/Luna IDs or automatic fallback. Saved sessions replay pinned old model/effort unchanged. The approved matrix is not a measured guarantee of quality, speed or savings.

## Optional assignment / replacement API

Declare an assignment only when durable user-requested execution limits or terminal replacement binding are needed. id/scopeRef/approvalRef/packetRef identify original authority. effortMinutes and repairAttempts are optional: omit both when no explicit limits were requested. Remaining-effort/repair handoff fields are optional for unbounded bindings but required when their original limit exists. Do not populate a count merely because a template contains one. Explicit legacy counts remain binding. Replacement escalation carries the identical assignment, terminal original name/run, hashed partial sources, findings/failure/remaining-criteria/resource citations and remaining allowance. Consumption persists before allocation, including transport failure; it cannot be replayed or reset. See the linked API for full fields.

## State and evidence

Only lead-accepted work is completed. Keep pending/active/blocked/paused/cancelled/abandoned/accepted state recoverable in existing context or a concise record. The [progress widget](progress.md) is a projection, not another scheduler. No invented percentages or mandatory accounting ledger. Native codemode must filter/aggregate before large retrieval; bounded sections answer a concrete question. Truncation is not complete evidence, and summaries do not replace actual change inspection. Keep raw logs on disk, not all session history in each packet.

Recall ranks relevance, not recency; use munin show <id> for known handoffs, then verify current state. Lead records concise decisions/outcomes without secrets. Do not blindly revive historical plans or audit suites. Capability/product specifications, transcript renderers, telemetry and new orchestration frameworks need demonstrated value, not default bureaucracy. Jev/Hermes remain deferred.

## Comparison underlying this change

The October 6 delivery skill required a separate contract and launch-mechanism approval, sequential-only workers and two fix cycles. These were added policy, not inherent Pi safety. Official [Claude Code permissions](https://code.claude.com/docs/en/permissions) supports autonomous modes with trust and tool permissions; [subagents](https://code.claude.com/docs/en/sub-agents) supports inherited permissions, concurrency and resumable optional turn limits. The user's local TAKT (work/git/takt at 03a7c1e; lib/run.md, lib/worker.md, lib/takt-run.js) automatically runs one stronger worker retry, three verification cycles and two review cycles after start takt, with isolated parallel worktrees. It has restrictions, but does not count each compiler correction as a customer-approved retry. Do not confuse it with the unrelated nrslib/takt project or copy its automatic push/force cleanup permissions.

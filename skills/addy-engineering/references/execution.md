# Existing execution machinery

The skill guides judgment. The harness owns lifecycle, grants, routing, workspace isolation, saved pins, control, recovery and evidence transport. No second scheduler, retry loop, stage-state store or automatic worker launch is needed.

[Shared service contract](../../../docs/execution-service.md): `createExecutionService(pi)` is already composed by `extensions/delivery-tmux/index.ts`. Existing tools are guarded clients of that exact service:

| Need | Existing capability |
| --- | --- |
| Direct implementation | Lead's ordinary tools; no worker needed |
| Fixed-role delegated slice | `subagent` with `agent: builder`, a concise task and actual authority |
| Independent command verification | `subagent` with `agent: validator`; no-edit grant |
| Independent integrated review | `subagent` with `agent: reviewer`; inspection-only grant |
| Compact builder compatibility | `developer`; preserve original approvalRef/packetRef on new work |
| Bounded read-only supplied-source discovery | `scout`; preserve discoveryAuthorityRef; no private-data permission from metadata |
| Owned reply/pause/resume/stop | `subagent_message`; exact owned name and correlated runId/questionId |
| Routing/profile inspection | `subagents_list`; explicit inspection, not completion polling |

Developer and Scout compatibility and persisted provenance remain explicit. Generic worker tasks do not require engineering-stage documents. Tool descriptions in a host may differ: obey actual higher-priority grants; do not use the generic service as a workaround for a host requiring authorization.

## Give a worker the right context

Supply purpose, behavior/slice, acceptance, exclusions, project rules, current source pointers/candidate identity, relevant checks/environment and expected evidence. Include this adapted workflow and Pi override context where relevant; reference source material rather than activating upstream skills as competing instructions. Workers may read on demand; no mandatory reading manifest. Context files/skills may load in children, but fixed grants still bind their actions.

A final reviewer packet covers the complete integrated task-owned diff including added files, intent/outcome, project rules, candidate identity and full validation logs. Ask for cited blockers/required corrections separately from nonblocking suggestions, evidence gaps and honest scope. Reviewer cannot edit, run shell/mutation experiments, accept the task or release it. Validator can execute authorized checks but cannot edit sources. The lead inspects returned evidence and alone accepts.

## Preserve lifecycle and authority

- Same-workspace ownership is exclusive while active, paused or waiting on a question. Use distinct existing linked worktrees for authorized concurrency; do not create/delete worktrees implicitly.
- Results arrive automatically. Do not poll profile/state APIs for completion or equate a terminal worker with acceptance.
- No nesting. Role tools cannot be widened by skill Markdown, upstream personas, cwd/tool/CLI overrides or project profiles.
- Reuse supported routing defaults; exact explicit model/effort must be available and supported before allocation. Saved sessions keep pinned models, thinking, identity, role/resource policy and provenance.
- Optional declared assignments/limits remain binding. Do not invent them when absent, reset allowances, retry automatically, adopt another lead's registry entries or blindly replay side effects.
- Before continuation/replacement reconcile partial source identities, findings, terminal state, remaining explicit allowance and resource-release evidence through existing controls/contracts.
- No worker is launched by merely loading the skill or constructing the service. Before session startup/after shutdown/invalid ownership, service operations fail closed.
- Execution/control tools remain model-only: do not expose them through codemode. Service code is trusted executable code, not an OS sandbox.

A workflow skill cannot prove actual consent. New private-data, destructive/outward or application-control actions need applicable authority; declarations and green checks cannot create it. Do not contact or control unrelated workers/applications.

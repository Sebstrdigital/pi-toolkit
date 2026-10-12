# Autonomous delivery — draft revision

**Status:** Draft r2, updated with user approval for planning only. This document is not active agent guidance or execution authority. Do not install, apply, or use it to expand an existing packet.

**Review history:** The user submitted acceptance of r1's four proposed decisions: whole-cycle delegation, ordinary failures as repair triggers, reusable project finish lines, and refinement after the unchanged trial. The overall review remained pending; no implementation or installation was authorized. R2 adds the subsequent discussion of Scout, model routing and incremental vertical delivery. Those additions are planning direction, not an approved execution packet. The previously generated r1 one-pager retains its original embedded source and review hashes; it does not represent r2.

**Timing:** Finish Dikta F1 and one complete Team task under their existing instructions. Use those observations to refine this proposal before seeking implementation approval. Do not interrupt, reload, resume, or change their workers from this workstream.

## 1. Customer goal

Delegate delivery, not typing. The customer participates in requirements, consequential product decisions, and project/client-specific end validation. After approving the work, they should be able to step away while agents implement, diagnose and repair problems, test, review, and deploy/validate the candidate in the agreed environment.

The reference behavior is the customer's Claude Code instruction: run autonomously until the task is implemented, tested and validated; for HomeLab-enabled projects, return after deployment and automated runtime/UI validation there. TAKT is the primary reference for agent-owned continuation and fix loops, not a requirement to reproduce Scrum or its scheduler in Pi.

**Success:** a ready-for-customer-acceptance candidate, with trustworthy evidence and explicit limitations, without routine permission requests or human workflow coordination. Fewer questions alone is not success if checks are skipped, requirements are guessed, or boundaries are crossed.

## 2. Proposed operating model

### Before execution

Use the existing conversation and project rules to establish the outcome, exclusions, consequential constraints, and what constitutes a ready candidate. Resolve customer-level uncertainty here. Reuse standing project validation guidance rather than asking the same environment questions every task.

Recommend Direct, Developer or Team proportionately; retain explicit customer selection and approval of the actual work. A concise Direct approval, compact Developer packet, or Team Agreement can delegate the whole applicable cycle. Do not introduce another required artifact suite.

### After approval

The lead owns continuation through the approved task set:

> Implement → test → diagnose and repair → environment validation → review → repair and recheck as needed → ready for customer acceptance.

This is a responsibility model, not a replacement for Team's required sequential fresh builder → no-edit validator → inspection-only reviewer. Environment checks can be part of validation. Any source changes after validation or review invalidate affected evidence; obtain fresh checks and required independent review on the resulting candidate before acceptance.

Within existing approval, the lead answers worker questions, supplies inspected context, dispatches permitted repairs, coordinates checks and review, accepts engineering-complete tasks, and proceeds to the next approved dependency. Worker completion is not acceptance. Task acceptance is not customer acceptance or production-release authority.

Progress notifications do not require replies. Do not disguise a permission question as a progress update or suppress meaningful safety/decision blockers. Detailed evidence remains inspectable.

### Staffing modes

| Mode | Who owns execution and completion |
| --- | --- |
| Direct | Current agent completes the applicable cycle and checks. No mandatory independent Team roles. |
| Developer | One bounded builder; lead resolves questions, inspects actual changes/evidence, and accepts under the compact packet. No automatic Team ceremony. |
| Team | Lead coordinates fresh sequential builder, no-edit validator and inspection-only reviewer, with permitted repair cycles and renewed checks/review. |

Until separately approved and implemented, fixed role grants, ownership controls, denied child discovery, and the single-worker slot remain unchanged. A validator reports a needed source repair to the lead; a builder implements it. A reviewer remains inspection-only. The lead uses supported owned-session controls; it does not adopt workers belonging to another session.

### Flat orchestration and Scout

Use one main lead, following TAKT's flat orchestration pattern. The lead classifies and decomposes work for all roles, selects the model and reasoning effort, dispatches bounded assignments, reconciles results, and owns integration and acceptance. Workers do not spawn workers. Do not introduce a manager for every role or require a decomposition step for work that is already small and clear.

Propose one fixed read-only **Scout**, usable during initial discovery/analysis, planning, implementation investigation, failure diagnosis, and validation/review preparation. Give it a focused question, approved accessible sources and relevant project rules. It returns cited findings, uncertainties and evidence gaps; it does not edit source, control processes, grant authority or accept work. Simple lookups can stay with the lead or deterministic tools when delegation adds no value.

Scout must not require the customer to select Developer or Team just to investigate. Its discovery grant must be explicit and bounded, respecting private-data and environment permissions. Initially keep external research with the lead. Adding Scout requires a supported runtime/tool path and role tests; do not relabel existing execution-only builder/reviewer controls. Scout consumes applicable supplied context, not unrestricted denied discovery.

### Incremental vertical delivery

Approve the destination, constraints and acceptance criteria, then plan and implement thin vertical increments. Prefer a builder assignment that owns a complete behavior across necessary layers, its tests and acceptance evidence, rather than separate database/API/UI assignments whose outcomes depend on repeated handoffs.

1. Establish the overall outcome, exclusions, important architectural constraints and final acceptance gates.
2. Inspect consequential unknowns; run a bounded spike only when its answer can change the approach. Give it a question, sufficient evidence and stopping rule, with applicable execution approval.
3. Implement the thinnest meaningful end-to-end slice that exercises the relevant seams and tests the important assumption.
4. Inspect actual integration/validation evidence and update the technical plan and residual-complexity estimate.
5. Expand through subsequent vertical slices until the approved outcome and final gates are satisfied.

Minimal capability is not permission to skip security, required tests or final qualification. A fake-backed UI can establish UI behavior but not real backend integration. A partial native-helper check cannot stand in for actual sandbox/runtime qualification. Record what each increment does and does not establish.

Some shared interfaces or foundations need small prerequisite tasks tied to the behaviors they enable. Vertical slices can still touch shared files; start sequentially, not with parallel writers. One builder normally owns a slice; a stronger replacement takes over that same slice with its source state and evidence, rather than splitting it into junior/mid/senior layers.

Use progressive planning: prepare the initial approach and next slices well, refine later slices from evidence. Do not mandate spending most tokens upfront or pretend planning removes intrinsic concurrency/security/integration difficulty. The customer need not approve every increment or routine technical refinement within the existing outcome, authority and budget. Material changes and explicitly agreed customer checkpoints still require them.

### Task-based model and effort routing

Roles define responsibilities and permissions; task profiles determine model and reasoning effort. Classify residual uncertainty, impact of mistakes and verification strength after discovery, not just file count, job title or model generation. Prefer deterministic scripts for mechanical extraction and result counting. Use reasoning off for straightforward factual work, increasing effort only when analysis is necessary.

The user's constraints are **no GPT-6.1 Sol default roles and no Astra anywhere in the proposed routing**. Also leave 6.1 Sol out of the initial fallback configuration unless separately selected. Candidate worker profiles for a first trial:

| Role | Starting model / effort | Bounded escalation candidate |
| --- | --- | --- |
| Scout | GPT-5.4 Mini, none for lookup; low for analysis | GPT-5.6 Terra, low/medium |
| Builder | GPT-5.6 Terra, medium; consider lower effort for genuinely routine work | GPT-5.6 Sol, medium/high |
| Validator | GPT-5.4 Mini, low; scripts collect mechanical results | GPT-5.6 Sol, medium |
| Reviewer | GPT-5.6 Sol, medium | Fresh GPT-5.6 Sol, high/xhigh |

These are hypotheses, not demonstrated capability or latency rankings. Reviewer escalation initially increases effort, not model size. Keep 5.5 and full 5.4 as comparison candidates, not mandatory roster entries. Do not assume an older model is cheaper/faster, or that an OpenRouter listing proves account access or Pi compatibility. Inspect provider, exact model ID, effort support, tool behavior and applicable client-data requirements before an approved trial. Main-lead configuration is a separate choice; this table does not change the current parent model.

Start stronger for an obviously difficult or high-risk assignment instead of wasting a mandatory weak first attempt. A task-owned check failure normally triggers repair with the current worker; it does not automatically justify upgrading.

For unsuccessful bounded repair, reasoning mistakes or underestimated complexity, the lead may dispatch one fresh same-role escalation per assignment within the approved effort/repair budget. Pass prior findings, actual partial changes, current source identity, remaining acceptance criteria and owned-resource state. Escalation does not reset budgets or widen scope, and saved workers retain pinned model/grants. After that allowance, diagnose and apply genuine stop conditions; no infinite model ladder. An environmental or permission blocker is not solved by more intelligence. No customer reapproval is needed for a fallback already covered by the execution contract.

Current Team tools support model selection on fixed roles; Developer inherits its parent's model and does not accept an independent override. Separate Developer routing and any fresh-escalation launch requirements therefore need explicit runtime approval and tests. Do not bypass existing controls to enact this draft.

## 3. Proposed instruction changes

These clauses are candidate wording, not instructions activated by this document.

### Lead: delivery responsibility

> Once the user has selected the mode and approved the actual work, own the complete applicable development cycle through the agreed ready-for-customer-acceptance boundary. Continue approved tasks and coordinate implementation, diagnosis, bounded repair, validation and review without routine customer reapproval. Resolve worker questions using approved authority and inspected evidence. Ask the customer only when their decision or additional authority is genuinely necessary.

### Builder: ordinary technical uncertainty

> Investigate and resolve ordinary implementation uncertainty within the approved outcome, paths, actions and constraints. A task-related compiler error, failed test, signing mismatch or other repairable check failure triggers diagnosis and bounded repair, not automatic customer escalation. Make reasonable technical choices consistent with the approved design, and record material implementation decisions. Do not guess customer requirements, weaken checks, expand permissions, or override an explicit safety stop. Ask the lead when required context is missing, rules conflict, ownership is uncertain, or resolution exceeds your grant.

### Packet/Agreement: whole-cycle authority

> Approval includes the ordinary in-scope edits, investigation, checks, permitted environment operations, and bounded repair/revalidation needed to reach the agreed outcome. The lead may coordinate these actions and advance through the listed approved tasks without repeated user approval. Customer checkpoints are only those explicitly identified, plus genuine escalation boundaries. Commit, installation, downloads, deployment, resource cleanup and outward actions are authorized only to the extent explicitly covered here or by applicable standing project approval.

Packets should name the baseline required checks and permitted diagnostic variants: for example focused tests or an ordinary Release build needed to qualify the same signed artifact. Exact recorded commands remain evidence; varying an invocation within an approved diagnostic class should not itself require another customer approval. Changes to required checks, signing restrictions or environment permissions remain consequential.

### Repair triggers versus stop conditions

Replace generic rules such as “stop on signing failure” when achieving correct signing is the task. Specify instead:

- **Repair trigger:** wrong helper entitlements; diagnose and adjust helper-only settings inside the allowlist and repair budget, then revalidate.
- **Hard boundary:** success requires granting the helper forbidden network access, changing the accepted isolation architecture, controlling an unrelated application, or exhausting the budget.

Existing narrow packets remain binding until explicitly revised. This proposal is not retroactive permission to ignore them.

## 4. When the customer is needed

| Situation | Proposed owner/action |
| --- | --- |
| Missing technical context that the lead can safely inspect | Lead obtains and supplies it. |
| Ordinary implementation choice within agreed design | Builder/lead decides and records as appropriate. |
| Failed task-owned test or review finding within repair bounds | Lead coordinates repair and renewed evidence. |
| Worker cannot mutate source because its role is validation/review | Lead dispatches a permitted builder; no role widening. |
| Requirements conflict or a consequential product trade-off is unresolved | Ask customer with recommendation. |
| Resolution materially expands scope, risk, permissions or architecture | Ask customer before expanding. |
| Needed environment/access unavailable and no approved equivalent exists | Report blocker and request the relevant decision. |
| Recovery budget exhausted or repeated attempts show no progress | Stop with preserved evidence and a concrete next option. |
| Subjective quality or business acceptance cannot be established by engineering checks | Return candidate and focused acceptance instructions to customer. |

An escalation should state the decision required, inspected evidence, attempted remedies, recommended option, and consequences. “The test failed; may I investigate?” is not a useful customer decision when investigation is already authorized.

Preserve bounded effort and repair limits. Clarify what counts as a repair cycle so every diagnostic command does not consume a new cycle. Do not replace budgets with unlimited retries or invent a retry allowance that bypasses runtime constraints.

## 5. Project-specific finish lines

Use project-local guidance, referenced by the task approval, to define reusable validation expectations. Avoid a new machine-readable profile or scheduler unless a demonstrated consumer needs one.

### HomeLab-enabled web/service projects

Candidate completion can require:

- Applicable automated tests, build/type checks and independent review as selected.
- Deployment to an explicitly approved project environment on the HomeLab validation VM.
- Applicable API/integration and Playwright UI flows against that deployed revision.
- Required fixture/data safety, permitted deployment/repair actions and teardown behavior.
- Candidate location, access instructions and retained evidence for customer acceptance; leave the environment available only when approved.

“All available tests” means the applicable project-defined checks, not permission to invoke destructive, production-connected or unrelated suites. Missing a required validation environment is a blocker, not a silent local substitution or skip.

### Dikta/native macOS

Candidate completion can require signed Release tests, nested packaging/signature checks, actual security/runtime qualification where applicable, and the approved listening/interaction checks. Linux HomeLab validation is not a substitute for native macOS evidence. Downloads, audio, microphone and desktop interactions require applicable prior authority.

### Tooling or documentation

Use proportionate functional and consistency checks. Do not invent a deployment or full Team gate simply to mimic another project's finish line.

For every project distinguish:

1. **Engineering-complete:** required objective evidence and selected review gates pass on the candidate.
2. **Ready for customer acceptance:** the candidate and meaningful acceptance steps are available; pending subjective checks are explicit.
3. **Customer accepted:** the customer's applicable outcome validation is recorded.
4. **Released:** separately authorized production installation/publication occurred.

## 6. Isolation and runtime: supporting work, not the first change

Worktrees protect source ownership and unrelated changes; they do not isolate GUI controls, credentials, microphones, processes or network effects. HomeLab or other real isolation can expand safe standing authority, but exposed resources still matter. The first implementation phase should clarify execution behavior, not replace the runtime or add parallel workers. The proposed Scout/routing phase is a bounded runtime extension, separately specified and approved.

Dikta's tests reaching real browser/muter controls are a genuine safety issue. A separately approved test-isolation improvement or suitable native validation environment may remove that recurring obstacle. Do not silently disable unsafe tests or add that repair to F1's current allowlist.

The installed tmux workflow documents a fixed 20-minute worker timeout. A larger packet effort budget does not change that runtime limit. Inspect timeout/recovery evidence from the Team trial before proposing any runtime adjustment. Any change must preserve cancellation, ownership reconciliation and pinned saved-session grants; no background scheduler or unbounded resume loop is proposed.

## 7. Small implementation surface, after approval

| Surface | Intended revision |
| --- | --- |
| `agent/AGENTS.md` | Clear whole-cycle responsibility and customer-versus-technical decision distinction. |
| `skills/discovery/SKILL.md`, `docs/lean-workflows.md` | Proportionate approval covering the applicable completion boundary; no extra required planning suite. |
| `skills/delivery/SKILL.md` and authority/delegation references | Lead-owned continuation, repair triggers, customer checkpoints, and source-bound revalidation. |
| Agreement/Plan templates | Explicit completion boundary, authorized diagnostic variants, bounded repairs and next-task continuation. |
| `agents/builder.md` and bundled tmux builder prompt | Resolve ordinary technical uncertainty; ask the lead at actual worker boundaries. |
| Validator/reviewer guidance, only where needed | Report to lead without changing inspection/no-edit grants. |
| Guidance tests | Exercise distinctions and preserve selection, approval, fixed-role, ownership and acceptance safeguards. |

### Proposed phased scope

1. **Autonomy guidance:** the instruction/template/test revisions above. Validate whole-cycle continuation without changing live trials or model defaults.
2. **Scout and flat routing:** one fixed read-only discovery-capable role, supported lead invocation, role-appropriate model/effort selection and bounded fresh same-role escalation. Specify exact allowed discovery actions, ownership/slot behavior, supplied rules/context, Developer routing requirements and saved-grant compatibility in an approved implementation packet. Test denial of mutation/nesting, cross-parent control, unintended privilege expansion and stale-source acceptance.
3. **Evaluate and tune:** compare the candidate profiles on real vertical assignments, then revise defaults or effort only from evidence. No mandatory additional roles, nested builder teams or parallel workers.

This is a staged proposal, not permission to edit runtime or configuration now. Avoid duplicate conflicting clauses and check all supported prompt paths. Preserve existing unrelated checkout changes. No global model change, scheduler replacement, project-rule migration or infrastructure installation is implied. Installation is a separate explicit action after implementation validation; do not hot-update the active Dikta trial.

## 8. Evidence and trial plan

### Baseline: F1 and one complete Team task unchanged

For each actual customer interruption record: session/message reference, task/mode, triggering condition, exact applicable instruction, whether a customer decision was necessary, and what cheaper lead-owned action was available. Separate customer approvals from worker-to-lead questions and ordinary progress messages.

Inspect whether the Team lead automatically dispatches validation/review, handles findings, preserves same-candidate evidence, reconciles resources and continues approved work. Do not infer those outcomes from the mode's name or static instructions.

### Revised trial, separately approved

Use one bounded real task with a clear finish line. Include the applicable project validation environment and permitted repair/deployment actions in approval. Preserve independent Team gates when Team is selected. Do not fabricate faults or modify infrastructure merely to produce a repair example.

Evaluate:

- Could the customer step away through the development cycle?
- Which interruptions actually needed customer judgment, and which were avoidable?
- Did agents resolve technical uncertainty and check failures without expanding scope?
- Did required tests, deployment validation and selected review actually run on the final candidate?
- Did repairs invalidate and refresh affected evidence?
- Were budget limits, unsafe conditions and non-progress honestly surfaced?
- Was the candidate useful for customer acceptance, without implied production release?

Report interruption counts by category, outcome/evidence quality, boundary compliance, observed effort and remaining limitations. Different tasks/models are not a controlled performance comparison. Static tests can establish guidance structure, not guarantee autonomous behavior.

### Scout, routing and incremental-delivery evaluation

After separately approving the relevant capability phase, keep model-routing observations distinguishable from guidance changes. Compare representative same-input tasks where practical, otherwise state task and environment differences. Do not invoke paid model experiments or deployments under this draft's planning authority.

Record task/vertical-slice outcome, starting residual-complexity assessment, role, provider/model/effort, source revision, validation strength, time where observed, token/cost evidence where available, repair attempts, escalation and missed findings. Verify that advertised reasoning-none actually reaches the provider as intended; an adapter label alone is insufficient.

Assess total cost per accepted slice: discovery + spikes/planning + implementation + handoffs/integration + repairs + validation/review. Do not optimize only builder tokens or make up latency/savings estimates. Check whether early end-to-end evidence reduced later uncertainty, whether Scout saved useful work, and whether supposedly easy slices needed reclassification. Keep independent final-candidate validation/review and no unauthorized actions as non-negotiable quality criteria.

## 9. Inspected basis and open evidence

### Local evidence

- `agent/AGENTS.md`, `agents/builder.md`, `docs/lean-workflows.md`, `skills/delivery/SKILL.md`, authority reference and Agreement template: ordinary autonomy already appears, but broad ambiguity/failure stop language and narrow packets can negate it.
- Dikta lead session `01a11940-7f77-76d7-b131-9880fae9a826`, P0/F1 messages inspected on 2026-10-08; `../dikta/docs/delivery/native-kokoro-migration/f1/developer-packet.md`: command-only repair approvals, genuine desktop-control hazard, and signing/sandbox stop rule. This records inspected revisions/events, not a claim about the session's current completion.
- TAKT checkout `03a7c1e`, `../takt/commands/sprint.md`, `lib/run.md`, `lib/takt-run.js`: start checkpoint, automatic retry and verify/review fix loops. Installed run/script hashes matched checkout during inspection.
- `~/.claude/lib/takt/run-local.md`: approved-environment HomeLab pattern. Inspected only; no SSH or deployment performed.
- TAKT process audit `../takt/docs/process-audit-2026-09-29/README.md`: prior handoff, purpose-loss and validation weaknesses. Audit statistics were not independently recomputed here. Avoid copying broad permission bypass, missing-validation skips, or post-review source repairs without renewed gates.

### External references, static inspection only

- [GSD Pi auto mode](https://github.com/open-gsd/gsd-pi/blob/main/docs/user-docs/auto-mode.md): agent-owned objective verification/remediation versus subjective acceptance and unavailable authority.
- [GSD recovery ADR](https://github.com/open-gsd/gsd-pi/blob/main/docs/dev/ADR-047-auto-mode-liveness-backstop.md): blocked guards need reachable recovery; detect unchanged no-progress loops.
- [Pi Boomerang](https://github.com/nicobailon/pi-boomerang): explicit autonomous task prompt and retained handoff summaries; neither no-question instructions nor summaries prove acceptance.
- [Pi isolation guidance](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/containerization.md): whole-process versus tool-only boundaries and exposed-resource limitations.

### Model-routing references and evidence limits

Official model pages inspected during this discussion describe 5.6 Sol/Terra/Luna as roughly flagship/mini/nano tiers, all with reasoning-none support, and 5.4 Mini as suitable for coding/subagent workloads. Product positioning is not a benchmark of these proposed role assignments:

- [GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol), [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [Model selection](https://developers.openai.com/api/docs/guides/model-selection) and [pricing](https://developers.openai.com/api/docs/pricing)
- [OpenRouter 5.6 Sol](https://openrouter.ai/openai/gpt-5.6-sol) and [5.5](https://openrouter.ai/openai/gpt-5.5): listings inspected, no authenticated execution or latency measurement performed.

The supplied indydevdan model-stack screenshot is an illustrative task-complexity reference, not adopted rankings or measured workload proportions. Its shown pricing differs from the inspected current official pricing; use provider rates at trial time. More capable models and more agents do not automatically improve accepted-result cost or autonomy.

### Pending / parked until Dikta evidence

- Completed unchanged F1/Team evidence and any timeout/recovery friction. Do not assume current status from earlier snapshots; inspect the final records when the customer returns.
- Exact Scout discovery grant and supported runtime admission/ownership design, including whether and how it shares the owned slot.
- Model/provider availability, effort mapping and empirical fit of starting/fallback profiles; no live calls or defaults are authorized by planning discussion.
- Suitability of targeted native test isolation; parallel execution and nested orchestrators remain outside this proposal.

No model-specific cause of Dikta's interruptions has been established; model routing must not conceal conflicting instructions.

**Resume cue:** "Review the Dikta baseline and autonomous-delivery draft r2." Read this document and recall the pi-toolkit decisions; inspect actual final F1/Team records, refine the proposed phases, and present the exact implementation scope for approval. Do not automatically monitor or control the Dikta session. Planning approval is not implementation or installation approval.

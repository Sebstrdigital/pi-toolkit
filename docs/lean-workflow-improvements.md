# Agreed lean workflow improvements

> Historical decisions below are not current execution policy. The user authorized removing added mode/approval, compiler-repair, exhaustive-file-list, forced pipeline and global serial restrictions on 2026-10-11. See `lean-workflows.md`. Explicit active-task limits remain binding; do not revive superseded ceremonies.

## Current direction — minimalist real development (2026-10-09)

The user approved simplifying the installed guidance after the Dikta Team trial stalled on document reading and speculative allowance accounting. The goal is Pi as useful as their Claude Code workflows, not a delivery framework for its own sake. New tasks default to 3–5 sentences, relevant project references and one compact approval/task record. Brief/Plan/Agreement are responsibilities, not mandatory separate files. No routine reading proofs, exhaustive identity inventories, snapshot suites, per-role minute pools or unrelated-app closure demands.

Current instructions live in `agent/AGENTS.md`, `skills/discovery/SKILL.md`, `skills/delivery/SKILL.md` and `docs/lean-workflows.md`. Use ordinary reversible-development autonomy; add process only for specific consequential risks. Team's independent validation/review and existing runtime grants/defaults remain. Markdown or existing JSON sprint/task state is fine; no new scheduler.

The earlier release decisions below are historical, not instructions to restart those jobs or recreate their document sets. This revision does not retroactively rewrite an active approval. Dikta is paused separately; the next test starts from a newly approved concise task after guidance reload. Parallel builders and `pi-flow` remain deferred.

## Historical status and authority

The user agreed to the direction below during the Dikta-session audit and subsequent workflow discussion. They explicitly requested saving these improvements in this file. This records design agreements; it does not approve installing packages, changing runtime settings, launching workers, or implementing an extension. Those actions still need a concrete proposal and approval.

The document names are now Brief, Plan, and Agreement (brief.md, plan.md, and agreement.md). User-facing execution choices are Direct, Developer for one bounded builder, and Team for coordinated implementation, validation, and review. Earlier references below to delivery and contract describe the existing implementation; the new user-facing terminology is Team and Agreement. Internal tool APIs need not be renamed merely for terminology consistency.

The user selected a complete first release containing the behavioral/document foundation, compact progress and quieter interaction, and a lightweight Developer path. Implementation starts in a new session after the concrete Agreement is approved. The user approved isolated validation followed by bounded installation into personal Pi, one pinned source-reviewed todo package after compatibility checks, hideThinkingBlock: true without reducing reasoning level, affected-configuration backups and a recorded rollback procedure, preservation of unrelated settings/files, refusal of conflicting targets, and no reload/interruption of the ongoing Dikta session. Model-default changes, Dikta application changes, push, and publishing are excluded. Symlink-based installation requires careful staging; deferring reload alone is insufficient isolation. The user also approved a task-only commit after validation and independent review, preservation of unrelated changes without blanket staging/reset/stash/history rewriting, narrowly scoped cleanup of this cycle's temporary planning documents and test resources after success, retention on interruption/failure, and retention of follow-ups, installation/rollback instructions, qualifying ADRs, and pre-existing documents/evidence. Temporary cycle documents stay outside the implementation commit. Unseparable uncommitted prerequisites require an explicit decision rather than silent inclusion. The user subsequently approved revision 1 of the complete Brief/Plan/Agreement under docs/workflows/first-release, including visible sequential execution, a four-hour active execution ceiling, and at most two focused fix cycles per task. approval.md records the final approval and frozen artifact hashes. The new executing session should proceed under that Agreement after baseline reconciliation, without reopening settled decisions.

## Purpose

Pi should remain a lean thinking and execution environment. The agent must understand the customer's problem and the reasons for requirements, recommend useful next steps, and avoid unrelated engineering work. More agents, tests, documents, or completed implementation tasks are not themselves evidence of customer progress.

The Dikta investigation demonstrated that careful execution and independent code review can coexist with poor sequencing toward a decision. It used nine headless workers, but obtained the matched Python/native comparison only after the user challenged native-only results. The improvement target is earlier useful decisions and fewer customer interventions, not increased orchestration.

## Default agent and discovery

The default agent is a collaborative thinking partner, not an automatic delivery coordinator. It should establish the intended customer outcome, motivation, constraints, important trade-offs, and exclusions before substantial implementation. It should use existing context and inspect evidence before asking questions, asking only about consequential gaps.

Discovery and experiments are optional approaches, not mandatory stages for every request. Substantial investigations should have a decision question, sufficient-evidence criteria, and a proportionate time or effort budget. The agent should seek the smallest safe experiment that could change the decision. It should not perfect experimental infrastructure merely because that work has begun.

At substantial blockers, the agent should reconsider whether the blocked work is necessary to answer the question and whether a cheaper safe alternative exists. An inconclusive or failed experiment can be a valid stopping result. Unrelated improvements should be parked rather than silently added to scope.

A short always-loaded policy should establish these principles. A discovery/decision skill should provide richer guidance on demand rather than adding a long permanent prompt or a mandatory extra planning agent.

## Execution recommendation and explicit selection

Once the direction is understood, the agent should recommend an execution path and explain its reasoning briefly. It should not merely present an unexplained menu.

Direct implementation is appropriate for small, understood, localized changes. One bounded helper may be appropriate when a single task benefits from separate context. Delivery is appropriate for consequential work with dependencies or substantial validation and review needs. When important uncertainty remains, the recommendation should be further discovery or a bounded experiment instead of starting a builder.

The user chooses the path. The delivery workflow must never be selected automatically. Choosing delivery authorizes preparing an execution contract; builders start only after the actual contract is approved. Direct work and a single helper should not inherit the full delivery ceremony, but still require applicable approval and safety boundaries.

The installed subagent controls are currently delivery-only. A standalone helper path requires a separately scoped capability and permission design; it must not be introduced by bypassing delivery-only controls.

## Autonomous approved delivery

After contract approval, the lead/coordinator owns implementation, validation, independent review, and resource reconciliation. Ordinary steps already covered by approval must not generate repeated permission requests. Routine technical problems should be resolved within approved scope and budget.

Execution should stop for material scope or trade-off changes, actions outside approved permissions, unresolved consequential decisions, exhausted repair or effort budgets, or evidence that the direction is no longer worthwhile. Autonomy does not authorize endless repairs, publishing, destructive actions, or scope expansion.

Discovery experiments and production delivery need proportionate validation. Any change to existing project validation rules or exception must be explicit and approved. Safety requirements must not be weakened simply to make an experiment finish.

For substantial delegated implementation, visible tmux workers are the preferred direction over unnoticed headless execution. The chosen mechanism must remain explicit. Extra workers are not a substitute for understanding purpose.

## Preserve intent through planning and delegation

A contract should authorize an understood direction, not be the first place where requirements are established. Substantial work needs durable customer purpose, chosen-solution reasoning, relevant experiment evidence, scope edges, and acceptance outcomes behind its execution plan.

Builders and reviewers must receive the applicable purpose and design references as well as their bounded task. Review should assess whether the result serves the approved outcome, not only whether requested implementation artifacts exist. Planning artifacts must have identified readers; writing a document is not enough if later agents never consume it.

Acceptance criteria should describe observable behavior or decision evidence. Implementation tasks, passing tests, and verified assets may support acceptance but must not replace the customer outcome.

The Brief preserves the customer problem, motivation, behavior, acceptance, scope, and exclusions. The Plan describes the approach, tasks, dependencies, validation, progress, and discoveries. The Agreement references the approved Brief and Plan and establishes execution permissions, budget, and stop conditions. Detailed templates, revision/approval mechanisms, and authoritative task-state implementation are technical details for the assistant to propose and implement within approved scope.

Conversation comes first. Once the change is sufficiently scoped, the agent recommends an execution path. Team work produces all three documents; one Developer normally receives one compact packet with the relevant information; small Direct changes need no mandatory files. Long discovery or interruption may justify saving a draft Brief earlier. The agent synthesizes documents from the discussion rather than repeating it as a questionnaire. Detailed documents primarily support agent handoffs and resumption. The user receives an understandable approval summary rather than being expected to read every artifact in full.

## Progress visibility and quieter interaction

A compact checklist or milestone widget should be available to the default agent for meaningful multi-step work and to the delivery lead in the main coordinator window. It should not be required for trivial interactions.

During delivery, the lead owns progress updates after inspecting worker evidence. Worker completion is not task acceptance. There should be one authoritative task state and no independently maintained duplicate task-management system in each child. The widget should project the plan rather than redefine it.

Progress should distinguish completed, active, pending, blocked, paused, and abandoned work as appropriate. It must not invent percentages, infer completion from elapsed time, or remove blockers merely to display a finished list. Routine technical activity and token telemetry should be secondary to progress toward the outcome.

Detailed execution output should remain inspectable without flooding the main narrative. The agent should speak for meaningful findings, decisions, blockers, and completion rather than narrating every tool call. Existing Pi display controls should be used before building custom rendering.

Pi already supports Ctrl+T for thinking visibility, Ctrl+O for tool-output expansion, and the hideThinkingBlock setting. No settings have been changed. Existing todo extensions should be evaluated before building a new one. The inspected leading candidate is @pify/todo; pi-native-todo is a simpler alternative. Neither has been installed or accepted as a dependency, and compatibility and source review remain necessary.

## Instruction hygiene

Project rules belong in the repository's own AGENTS.md. Stale assumptions about unavailable TAKT or context-mode tools should be corrected through approved project changes. Applicable safety and validation rules should remain, with distinctions between application changes and isolated experiments made explicit.

## Development-cycle completion and lasting records

The cycle should end with validated work and an authorized git commit. Its commit message preserves the change, motivation, important trade-offs, and validation summary. Cycle-owned planning documents may then be cleaned up as explicitly authorized. Failed, blocked, or interrupted work keeps resumable records; cleanup never includes unrelated documents or pre-existing evidence.

ADRs are not routine artifacts. A retained ADR is appropriate for significant architectural decisions or major features with consequential design choices. Five or more changed files is a rough signal, not a threshold: small changes can alter architecture and large mechanical changes may not. ADR acceptance does not authorize implementation.

## Non-goals

We are not recreating TAKT or Claude Code inside Pi. There is no agreement to add mandatory Epic/Feature/Sprint stages, a planning-review agent, a new orchestration framework, parallel writers, automatic publishing, or a large progress dashboard.

## First-release scope and execution timing

The user approved the complete first-release direction, rather than a guidance-only release. The target is a validated toolkit update ready for a fresh Dikta session, not changes to Dikta application code.

The first slice contains short default-agent guidance, one discovery/decision skill, the existing workflow adapted to explicit Team selection, and supporting Brief/Plan/Agreement templates. The second slice contains one evaluated existing todo widget and quieter interaction using existing display controls where possible. The third slice contains a properly scoped lightweight Developer path without full Team ceremony. Visible sequential Team workers, purpose-preserving packets, and coordinator-owned acceptance remain required parts of the agreed behavior.

Interactive decisions should be settled in this session. A subsequent session should read the saved Brief, Plan, Agreement, repository baseline, and exact next action, then execute autonomously within the approved boundaries. It must not interrupt the ongoing Dikta session or silently adopt unrelated uncommitted work. Validation should cover repository checks, isolated runtime behavior, representative Direct/Developer/Team scenarios, and installed readiness. Prompt-behavior demonstrations are evidence, not a guarantee of future model compliance. The human Dikta trial remains a separate acceptance observation.

## Pre-existing prerequisite requiring a decision

The currently installed visible tmux adapter, bundled vendor runtime, associated tests, and installer/documentation changes are uncommitted. HEAD 73516d7da62755a88f777f5031ffd4684f01a8f5 does not contain extensions/delivery-tmux, vendor/pi-interactive-subagents, or its three test files. These are directly relevant prerequisites for visible Team execution and the Developer path, not arbitrary unrelated edits. docs/delivery/tmux-production-integration/outcome.md records accepted Phase C live validation but explicitly states that the implementation remains uncommitted. A clean reproducible release cannot silently depend on these uncommitted files. The user explicitly approved identifying, revalidating, independently reviewing, and committing that prerequisite separately before the first-release commit. Existing historical evidence and unrelated files remain excluded. The user also recommended a compact or new session before autonomous execution; no implementation will start in this planning session.

## Follow-up candidates and deferred work

This section retains discussed possibilities without turning them into an approved backlog. Each candidate needs a demonstrated need, bounded proposal, and approval before implementation. First-release essentials must not be deferred merely because they also have possible future extensions.

- **`pi-flow` dedicated orchestration session (new idea; not implementation-approved):** provide a command that starts or attaches to a separate purpose-first delivery lead session. The default agent remains the customer-facing thinking partner and hands over the actually approved purpose, scope, constraints, acceptance and budget; the dedicated orchestrator runs the selected Developer/Team work visibly on the side and returns meaningful progress, consequential questions and evidence-backed outcomes. Prefer one extension reusing the existing runtime unless real requirements justify multiple extensions; avoid a second scheduler or manager-per-role hierarchy. This is a promising separation-of-context/interaction hypothesis, not a settled architecture or authorization for nested delegation, parallel writers or bypassed Team/Developer gates. Before implementation, resolve who owns approval and final acceptance, how progress/questions reach the default session, what happens when either session closes, and how shared-workspace writer ownership and stop/resume are preserved. Evaluate after small real-project workflow trials; do not expand the current activation/smoke work to build it.
- Durable capability/product specifications may be useful for areas repeatedly modified. There is no first-release requirement to document the whole product or adopt OpenSpec, Spec Kit, or another full framework.
- A structured JSON task-state schema, dependency scheduler, and stronger resume automation may be useful if actual machine consumers require them. First-release tracking still needs one authoritative state and a coherent widget projection, but not a new scheduling framework.
- Custom transcript renderers, richer blocked/paused visuals, and worker-telemetry integration may help if the evaluated widget and Pi's existing display controls are insufficient. A custom dashboard is not part of this release.
- Stronger runtime enforcement of Agreement boundaries, revision pinning, or budget checkpoints can be considered after observing the instruction-based behavior. Safety and existing launch/ownership checks must remain intact in the first release.
- Specialized discovery or experiment agents, more worker roles, broader model routing, and parallel execution are not first-release features. Add them only when separate context has demonstrated value; more agents are not the success measure.
- Broader project-rule migrations and stack-specific validation policies can follow a targeted audit. The first release must not quietly rewrite Dikta's validation rules or unrelated project instructions.
- Extending installer rollback and upgrade diagnostics can be evaluated after the first-release installation and recovery requirements are satisfied.
- The repository README separately defers Jev and Hermes work. This release does not reopen those items.

The historical alternatives and source comparisons remain available through session evidence and Munin. Choosing lean Brief/Plan/Agreement documents does not commit us to Scrum ceremonies, spec-as-source code generation, full product-spec maintenance, or routine ADRs.

## Deferred improvement candidate — idea exploration before delivery

Investigate whether the pinned `vendor/addy-agent-skills/skills/idea-refine/` material, or an existing installed brainstorming capability, can improve open project/feature discussion before delivery commitment. Preferred direction: treat it as the open end of DEFINE rather than create another mandatory workflow; when a direction becomes sufficiently understood, offer a proportionate short PLAN or Direct BUILD. Brainstorming must not automatically authorize implementation or impose a phase/document ceremony. This is a recorded candidate only: do not build, install, or search external integrations from this entry without a separate approved proposal.

## Evaluation

A pilot should test whether the agent establishes the customer purpose before implementation, produces decision-relevant evidence earlier, recommends an appropriate execution path, preserves intent through handoffs, and completes approved delivery with fewer routine user interruptions. Progress should be understandable at a glance while details remain available.

## Inspected evidence

The Dikta evidence includes docs/handoff-native-kokoro-2026-10.md and docs/delivery/native-kokoro/contract.md, status.md, and decision-sprint/results.md in the dikta repository, plus the associated ongoing session transcript.

The toolkit evidence includes skills/delivery/SKILL.md, skills/delivery/references/delegation.md, scripts/delivery-agent.ts, and extensions/delivery-worker/controller.ts.

The TAKT evidence includes commands/feature.md, commands/takt.md, lib/run.md, lib/worker.md, and docs/process-audit-2026-09-29/README.md. Its audit specifically identified customer purpose and exclusions being lost between feature planning and worker/reviewer handoffs.

Pi's installed documentation and example todo extension were inspected, along with the package pages for @pify/todo and pi-native-todo and the upstream @pify/todo extension entry point and bundled skill. Package descriptions are not proof of compatibility or security.

---
name: addy-engineering
description: Guide substantial engineering through DEFINE, PLAN, BUILD, VERIFY, REVIEW, SHIP; use when the user asks for a six-phase/six-step cycle, a structured engineering workflow, or an understood brainstorming direction needs a proportionate plan.
license: MIT upstream references; see ../../vendor/addy-agent-skills/LICENSE
---

# Addy engineering for Pi

One engineering path, not six agents or a second scheduler. Use when the user explicitly asks for this cycle or when a substantial brainstorming conversation reaches an understood actionable direction. Loading the skill, proposing a phase, or discussing a plan is not implementation, private-data or release authority. A clear request to execute an understood task authorizes ordinary reversible implementation, supporting-file changes, diagnosis, repair and reconciled continuation. Advice or a proposal alone does not.

Pi may advertise this skill through an installed directory symlink. Resolve the physical skill directory first (for example, `realpath <advertised-skill-directory>`); resolve all relative file links below from that physical directory, not the user-agent alias. Internal `references/` files also work through the alias, but `../../vendor/` and `../../docs/` require the physical toolkit path. This is source-path resolution, not permission to load another checkout or executable integration.

Read [Pi adaptations](references/pi-adaptations.md) before upstream material. This skill and those adaptations are the active workflow; the pinned sources are supporting engineering references, not a second instruction path. Keep old entry points available, but do not invoke conflicting old workflow skills/commands for the same task. Higher-priority instructions, actual user authority and project rules remain binding. Resolve a consequential conflict instead of claiming this Markdown overrides system policy.

Use proportionate Direct, Developer or Team mechanics already available. No mode-selection ritual or separate Agreement for settled execution authority. When delegating, read [execution mapping](references/execution.md); use existing fixed-role tools over the extracted service. No nesting, silent fallback or automatic cross-model offers.

## DEFINE — understand the outcome

For open brainstorming, stay in DEFINE: explore the problem, options, constraints and desired outcome without manufacturing a phase ceremony or implementation commitment. Once the direction is understood, say so and suggest the smallest proportionate next step—usually a short PLAN, or Direct BUILD for a small settled change. If the user explicitly requests this cycle, enter the phase that fits the settled context immediately rather than restarting DEFINE; after bug diagnosis and candidate fixes, that is usually PLAN. Before opening a fresh opt-in session, inspect selected project/parent/global instructions and required tools together; use the optional [project-aware entry aid](../../docs/addy-engineering.md#project-aware-entry-aid) when useful. Resolve known workflow/tool conflicts with applicable authority, preserving quality/safety rules—not by suppressing context, pretending unavailable tools exist or claiming a skill overrides higher-priority instructions. A mechanical preflight is not semantic compatibility; the session must verify its full effective loadout before implementation.

Inspect current source, relevant project rules, dirty work, existing task context and valid baseline evidence. For continuation or follow-up, read the latest outcome/handoff and inspect current source state before proposing more work. Distinguish historical pending checks from subsequent acceptance. Identify what already changed, actual versus reused evidence and remaining gaps; do not ask for instrumentation/checks already completed or turn an unperformed measurement into a pass. Reuse an existing issue, conversation, specification or JSON; no prescribed filenames or document suite. Do not overwrite another task's incomplete plan.

Observe a fresh task baseline independently of workflow compatibility: current revision/dirty ownership and the project-required valid pre-edit checks. Do not compare a new task to a hardcoded old release/status snapshot or reset newer work to satisfy a previous task's preflight. An entry aid's Git observation is not a green product-test baseline.

Preserve Addy's specification content, proportional to the task:
- **Objective:** who needs what, why, specific acceptance and explicit non-goals.
- **Commands:** exact project build/test/lint/runtime commands with flags and prerequisites; discover rather than assume npm or browser tooling.
- **Structure:** relevant source, tests, interfaces and dependencies.
- **Style:** existing conventions and a representative example where useful.
- **Testing:** affected behavior, focused regression, integrated checks, realistic runtime/manual scenarios.
- **Boundaries:** always do, ask first, never do; ownership, private-data, live effects and release exclusions.

For independently testable capabilities, identify boundaries and dependency direction before slicing; use a concise capability map when useful, not mandatory per-module specs. Surface consequential assumptions; ask only when evidence cannot settle a product, scope, security, permission or ownership decision. A known outcome and clear execution request do not need another approval turn.

Basis: [spec-driven development](../../vendor/addy-agent-skills/skills/spec-driven-development/SKILL.md).

## PLAN — choose the smallest useful route

Map dependencies and risks from the actual code. Consider cheaper alternatives. Prefer thin vertical slices; use risk-first proof or contract-first slicing when uncertainty or independent consumers justify it. Each slice states behavior, acceptance and useful verification. File lists are pointers unless explicitly restricted; necessary supporting files do not automatically expand the outcome.

Choose the validation route early. Inspect whether normal startup can access installed/private assets, download models, migrate data, prompt for permissions, claim devices or change a running application; isolated config/HOME alone does not exclude these effects. Summarize the understood task authority, acceptance/checks and exclusions concisely in existing context. Ask one concrete permission decision for necessary unresolved effects when possible; do not invent blanket approval or repeat settled grants. Offer an authorized narrow read-only prerequisite check instead of asking the user to certify unknown cache/migration conditions from memory. Other authorized fake-backed implementation may continue while a distinct runtime gate waits.

Verify within every slice, then on the integrated candidate. Keep a short ordered checklist or existing tracker as the single work record; no fixed slice size, time pool, repair-count cap, recurring human checkpoint or compulsory role cycle. Parallel workers require independent linked worktrees with the intended candidate; serialize shared/dependent changes. Park unrelated cleanup and optimization.

Basis: [planning and task breakdown](../../vendor/addy-agent-skills/skills/planning-and-task-breakdown/SKILL.md), [incremental implementation](../../vendor/addy-agent-skills/skills/incremental-implementation/SKILL.md).

## BUILD — autonomous, tested slices

Discover the repository's test stack before coding. For behavior changes use **RED → GREEN → REFACTOR**: write a focused failing test, confirm it fails for the intended missing behavior, implement the minimum useful fix, then improve task-owned structure with tests green. For bug fixes, reproduce before fixing; preserve repro conditions and a regression test that fails without the fix. Static documents/configuration need appropriate structural checks, not fabricated behavioral RED evidence.

Keep each slice working and run its affected checks before moving on. Prefer real implementations; fake only unsafe, slow or nondeterministic boundaries. Preserve unrelated dirty work; do not require a clean checkout, stash or automatic commits. Continue ordinary diagnosis and repair under existing task authority.

When a check fails, stop adding unrelated functionality, retain the failure evidence, reproduce → localize → reduce → identify the **root cause** → fix → guard against recurrence → verify the original scenario. Compiler/test/harness corrections are implementation, not repair tokens. Do not disable checks merely to get green. If a required check is wrong, diagnose it; changing the required quality bar needs applicable authority. When progress stalls, change strategy; ask for consequential new decisions, demonstrated no progress or exhausted explicit user-agreed limits, not routine red checks.

Basis: [TDD](../../vendor/addy-agent-skills/skills/test-driven-development/SKILL.md), [debugging and error recovery](../../vendor/addy-agent-skills/skills/debugging-and-error-recovery/SKILL.md).

## VERIFY — project-owned evidence

Project rules own quality standards, commands, environments and release procedures. Apply task acceptance and the project's standing Definition of Done; upstream examples help fill reasoning gaps, not invent native-app web metrics or universal npm commands.

Validate focused changes and required integrated checks on the integrated candidate. Include realistic runtime/manual verification for the changed user path and its failures when authorized. Isolate live-side-effect tests before execution and verify the effective boundary; invoking shell or changing HOME alone is not proof of product isolation. Do not stop the application under development or interfere with unrelated applications. Use approved browser/MCP integrations only; no private-data access from screenshots, profiles, cookies or tokens without authority.

Record exact candidate identity, commands, environment, result counts and full-log pointers. Reuse evidence only for unchanged candidate/conditions; renew affected evidence and required integrated checks after edits, not assurance-only full reruns. Missing or excluded checks are not passes. Keep an explicit manual checklist and honest gaps; fixture success does not prove live providers or installed behavior.

Basis: [Definition of Done](../../vendor/addy-agent-skills/references/definition-of-done.md), [testing patterns](../../vendor/addy-agent-skills/references/testing-patterns.md).

## REVIEW — complete integrated task, not isolated slices

Inspect the complete task-owned diff including added files, intent, project rules, outcome and validation evidence on the exact candidate. Review correctness, readability/simplicity, architecture, security and performance. Include compatibility, failure paths and whether tests genuinely guard the new behavior. Lead inspection is not independent review.

For Team, final independent integrated review is the default gate before acceptance. Prior independent review of the exact candidate can satisfy it; a new worker per slice is not required. Direct/Developer use independent review proportionate to risk and requested gates; honor any explicitly requested independent gate. If independent review cannot run, report the missing gate rather than relabel self-review or fabricated sequential personas as independent.

Keep the reviewer inspection-only and the no-edit validator boundary intact. A reviewer can propose mutation cases but cannot edit or run shell experiments; an authorized builder/lead may execute them in an isolated disposable fixture. Worker completion is not acceptance. Categorize findings: blockers/required corrections versus nonblocking suggestions. Fix blockers in scope, renew affected evidence and obtain renewed review of affected changes; unchanged review/evidence can be reused. Reassess the integrated candidate after repairs, not only the last patch.

The lead alone accepts against the outcome and requested gates. Green tests/review are not release permission.

Basis: [code review and quality](../../vendor/addy-agent-skills/skills/code-review-and-quality/SKILL.md).

## SHIP — handoff first, release only with authority

Return the exact candidate, useful outcome, actual and reused checks, review disposition, consolidated manual checklist and remaining risks/gaps. Give the user one immediate next action and any specific unresolved permission; keep lengthy commands/matrices and diagnostic history behind evidence pointers rather than repeating the full procedure at every checkpoint. Preserve enough concise task context to resume: purpose, settled decisions/authority, exclusions, candidate identity, next action and evidence pointers. Conversation or existing issue/JSON is sufficient; use Munin when available and omit secrets. Before later advice or follow-up, read this current outcome and renew only affected/required evidence, not assurance-only checks or duplicate implementation.

No automatic commit, merge, installation/reload, deploy, publication, revert, artifact deletion or worktree cleanup. Prepare applicable release/rollback procedures without executing them. Execute outward/destructive actions only under applicable explicit authority and project procedures. Acceptance of code does not authorize release or retirement of the old workflow.

For staged workflow migration: isolated opt-in candidate → separately approved activation after a fresh baseline/ongoing-worker check → useful bounded real tasks → adjust from evidence → default/old-policy retirement only when separately justified and approved. Do not contact or control unrelated agent work to satisfy a stage. Specialist skills remain on demand; use the [catalog and override table](references/pi-adaptations.md), not blanket loading.

Basis: [shipping and launch](../../vendor/addy-agent-skills/skills/shipping-and-launch/SKILL.md).

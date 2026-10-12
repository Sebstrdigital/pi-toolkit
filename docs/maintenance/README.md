# Maintenance index

*Housekeeping snapshot: 2026-10-12. This is a navigation and planning aid, not
execution authority or a claim of installed/live readiness.*

## Current map

| Area | Current source of truth | What it is not |
| --- | --- | --- |
| General workflow and authority | [lean workflows](../lean-workflows.md) | A mandatory ceremony or scheduler |
| Delivery compatibility/runtime boundary | [delivery workflow](../delivery-workflow.md), [execution service](../execution-service.md) | Proof of live installation or acceptance |
| Scout/routing source capability | [Scout routing](../workflows/scout-role-routing.md) | A quality, cost, or account-entitlement guarantee |
| Six-phase guidance | [Addy engineering](../addy-engineering.md) | A replacement runtime or default mandatory workflow |
| Context handling | [native code mode](../codemode.md), [context backlog](../workflows/context-efficiency-backlog.md) | Evidence of measured savings |
| Optional user-facing features | [one-pager](../one-pager.md), [progress](../progress.md) | Default installation or a scheduler |
| One-shot compatibility details | [one-shot transport](../one-shot-transport.md) | The current mandatory Team gate |
| Retained setup/history | [Pi fresh start](../pi-fresh-start.md), [day-one handover](../handover-day1.md), `delivery/` | Current grants, configuration, or cleanup authority |

The root [README](../../README.md) is the concise setup entry point; the
[documentation map](../README.md) is the fuller navigator.

## Two-module source map

### 1. Machinery and runtime

| Boundary | Important paths | Current meaning |
| --- | --- | --- |
| Installer/client entry points | `install.sh`, `scripts/install-options.mjs`, `scripts/delivery-agent.ts`, `extensions/delivery-worker/` | The default installer links the one-shot compatibility transport; option flags add tmux, progress, or one-pager resources. Installing a link is not evidence of an active host loadout. |
| Opt-in delivery client | `extensions/delivery-tmux/index.ts`, `tools.ts`, `requests.ts` | Fixed Team roles, Developer, and Scout request admission/tool surface. |
| Shared service | `extensions/delivery-tmux/execution.ts`, `workspace.ts`, `allowance.ts`, `role-routing.ts` | Session lifecycle, workspace/allowance admission, and exact route preflight behind the client adapter; see [execution service](../execution-service.md). |
| Fixed prompts/runtime | `agents/`, `vendor/pi-interactive-subagents/agents/`, `vendor/pi-interactive-subagents/pi-extension/subagents/` | Local wrappers and pinned vendor runtime/provenance. Vendor material is not a second installed controller. |
| Roles and ownership | `requests.ts`, `workspace.ts`, [Scout routing](../workflows/scout-role-routing.md) | Fixed builder/validator/reviewer Team roles, one builder-shaped Developer, and read-only Scout. Fixed grants are tool limits, not a sandbox. Scout shares the same workspace ownership system: a same-workspace active Scout excludes a writer, while distinct linked worktrees can coexist. |

### 2. Workflow and skills

| Skill/source | Purpose | Installer / observed status |
| --- | --- | --- |
| `discovery` | Resolve consequential uncertainty before choosing an approach. | Default installer; personal symlink observed. |
| `addy-engineering` | DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP, entered proportionately using settled context. | Default installer; personal symlink observed; natively discoverable. |
| `delivery` | Proportionate authorized delegation, verification and review; Team compatibility name. | Default installer; personal symlink observed. |
| `debug` | Debugging breadcrumbs for interruption and resumption. | Default installer; personal symlink observed. |
| `grill-me` | User-requested stress-testing/interview of a plan or design. | Default installer; personal symlink observed; not the normal brainstorming default. |
| `zoom-out` | Explicit broader context or higher-level code perspective. | Default installer; personal symlink observed; explicit-only (`disable-model-invocation`). |
| `duadigital-pdf-maker` | Markdown to branded Dua Digital PDF. | Default installer; personal symlink observed; Chrome prerequisite. |
| `homelab-validation` | Guidance for container/staging/database/browser validation environments. | Default installer; personal symlink observed; SSH prerequisite and project rules still apply. |
| `one-pager` | Browser briefing/guide/explainer generation. | Opt-in source (`--with-one-pager`); audit observed a personal symlink. |
| `skill-authoring` | Skill-writing reference material. | Repository source, not default-installed and not observed installed. |
| `diagram-design` | External diagram skill. | External source outside this repository; used to create the documentation diagrams. |
| `vendor/addy-agent-skills/` | Pinned upstream reference and provenance. | Reference-only, not a discoverable second workflow. |

The installer lists the authoritative default/opt-in sources in
`scripts/install-options.mjs`; an observed symlink neither changes that policy
nor proves Pi has loaded a resource in a particular session.

## Maintenance records

- [Fresh-session handoff](reproducible-baseline-handoff.md): approved next task,
  current state, evidence and boundaries for preparing the reproducible baseline.
- [Machinery plan](machinery-plan.md): reproducibility, cache retention,
  routing, retrieval, and context proposals.
- [Workflow and skills plan](workflow-skills-plan.md): planning, fixtures,
  outcome clarity, and optional skill guidance improvements.
- [Retention inventory](retention-inventory.md): source/evidence/cache
  classification. It authorizes no deletion, movement, archive action, or
  installation.

## Historical-status convention

Preserve historical records and their provenance. When a record is stale,
place a brief notice at the top pointing to current guidance rather than
rewriting its facts. In particular, `docs/pi-fresh-start.md`,
`docs/handover-day1.md`, and `docs/lean-workflow-improvements.md` are retained
context; active task authority comes from the current request and applicable
rules.

## Documentation diagrams

- [Execution architecture](../diagrams/execution-architecture.html) — guarded
  service boundary, retained one-shot compatibility, and workflow acceptance.
- [Engineering workflow](../diagrams/engineering-workflow.html) — proportional
  DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP guidance.
- [Skill discovery](../diagrams/skill-discovery.html) — installation,
  advertisement, invocation, and separate authority checks.

These static diagrams document existing source and guidance. They do not change
renderers, settings, resources, runtime behavior, or authority.

## Evidence basis

This map reconciles source paths above with the 2026-10-12 housekeeping audit
and retained retrospectives, especially [the Dikta retrospective](../workflows/dikta-retro-2026-10-12.md)
and [the native Kokoro retrospective](../workflows/native-kokoro-workflow-retrospective.md).
It does not replace either record's stated evidence limits.

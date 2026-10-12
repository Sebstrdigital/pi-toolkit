# Fresh-session handoff: reproducible pi-toolkit baseline

## Current outcome and next action

The housekeeping documentation and three static diagrams are lead-accepted. The user approved the recommendation to prepare a reproducible accepted-source baseline, but requested a session reset before execution. **This handoff is preparation only; start the task in the fresh session.** Do not redo the housekeeping audit or build more machinery.

Purpose: a fresh isolated checkout/candidate should reproduce the accepted toolkit source, tests, resources and installer behavior without depending on untracked files or personal installed symlinks. Preserve the useful current workflow: discussion → proportionate DEFINE/PLAN → autonomous authorized development → manual validation where needed.

Recommended mechanics: Direct for reconciliation, narrow ignore rules and isolated checks; independent integrated review of the exact proposed baseline/commit scope before asking for commit permission. No compulsory role pipeline or document suite.

## Task authority and boundaries

The user said “Let's go with your recommendations” after the proposal to identify the release candidate, separate generated material with narrow ignore rules, validate an isolated clean candidate and present the exact commit scope. That authorizes this understood preparation/validation task and ordinary in-scope diagnosis/repair once resumed. It does **not** authorize committing: the proposal expressly retained separate approval of the exact commit scope.

Allowed outcome:
- Reconcile active source, skills, tests, vendor licenses/provenance, supporting scripts and current documentation into a bounded candidate manifest.
- Add narrow repository ignore rules for positively identified Finder metadata and regenerable compile caches; demonstrate that intended source, outcomes/provenance and valuable evidence are not accidentally hidden.
- Assemble a fresh task-owned isolated candidate, perform required source/fixture checks and fake-HOME installer/resource-discovery checks without altering the personal installation.
- Return exact included/excluded paths, candidate identity, review disposition, checks/gaps and an understandable proposed commit scope.

Preserve all existing dirty/untracked work and the real index. Do not reset/stash/clean, blanket-stage, delete, move/archive, overwrite unknown work, or require a clean live checkout. Use an isolated index/repository or candidate for reconciliation where helpful, not the user's real staging area. Keep evidence and recovery material intact. Ask once if actual ownership or an inseparable prerequisite cannot be resolved from source/evidence.

No commit, push, publish, install/reload, app/session/process control, private settings/session/credential/model-data access, downloads or new integration. No changing runtime behavior, routing, saved grants/pins, required checks or legacy compatibility solely to simplify packaging. Correct task-owned supporting harnesses when necessary; a consequential new behavior or authority boundary needs a decision. No new scheduler, dashboard, benchmark project, brainstorming implementation or broad repository cleanup.

## Current state — observation, not a future invariant

Repository: `/Users/sebastianstrandberg/work/git/pi-toolkit`.

At handoff creation, branch `main`, HEAD `3183f9e46d9cf5fd22dd0487569b6abe0bb902f0`; `git status --short` reported 69 entries (29 modified, 40 untracked entries, including grouped directories). These are status entries, not a full file inventory. Renew state and ownership in the fresh session; do not reset newer work to match this observation.

Much accepted implementation remains dirty/untracked, including the extracted execution service, native codemode/routing/Scout/concurrency improvements, Addy adaptation, one-pager capability, tests, and current docs. **Untracked does not mean unused or disposable.** Determine the actual accepted source from current code and retained outcomes rather than committing the entire working tree blindly.

Personal installation is symlink-based and points at this live repository. Only symlink targets were inspected during housekeeping, not private settings or sessions. Use the maintenance index and audit receipts for extension installation status; do not infer live loading. Observed toolkit skills: debug, grill-me, zoom-out, PDF maker, HomeLab validation, delivery, discovery, Addy engineering, one-pager. Zoom-out is explicit-only; skill-authoring is source-only/not observed installed; diagram-design is external generation tooling, not toolkit-owned. An observed installation is not a current active-loadout or provider-readiness assertion. Do not touch these links.

## Read next, on demand

1. [Maintenance index](README.md): concrete two-module source map and skill catalog.
2. [Machinery plan](machinery-plan.md): P1 reproducibility and P2 cache/retention; later items are proposals, not this task.
3. [Retention inventory](retention-inventory.md): measured sizes and keep/candidate classifications. `docs/delivery/` held 20,893 regular files / 225,984,065 bytes (~265 MB allocated), largely evidence/snapshots/caches. Do not blanket-ignore or delete it.
4. [Root README](../../README.md) and [documentation map](../README.md): current entry points.
5. Actual `scripts/install-options.mjs`, `extensions/delivery-tmux/`, `scripts/delivery-agent.ts`, active `skills/`, tests and vendor manifests/licenses as required for scope. The one-shot compatibility path is still installed/supported, not obsolete.
6. [Execution service](../execution-service.md), [one-shot reference](../one-shot-transport.md), [Addy](../addy-engineering.md), [lean workflows](../lean-workflows.md), [progress](../progress.md) and [one-pager](../one-pager.md) for real dependencies/boundaries. Read official installed Pi docs fully for any Pi-resource/API changes or disputed loading semantics; no need to re-read all history.

## Accepted checks and evidence

- Housekeeping baseline and integrated test suite: **233 passed, zero failures/skips**. Later documentation-only refinements reused unchanged executable evidence; this is not a fresh baseline for the next task.
- Documentation/diagram links: **101 internal targets, zero missing**. Static diagram accessibility/single-file, geometry and skin checks passed; lead also checked 21 connector source/destination endpoint pairs. Independent whole-document and whole-diagram reviews found no remaining material blockers after corrections.
- Diagrams: [architecture](../diagrams/execution-architecture.html), [workflow](../diagrams/engineering-workflow.html), [skill discovery](../diagrams/skill-discovery.html). The user requested opening them and they were opened; no explicit visual sign-off was reported. Manual font/responsive/print qualification remains unperformed. An earlier isolated local Chromium lint returned three **unmeasurable** results, not visual passes; it deviated from the VM preference and was not repeated.

Evidence currently exists at:
- `/tmp/pi-toolkit-housekeeping-docs-2026-10-12/`: preimages, `lead-final-owned-docs.diff`, hashes, lead check receipts, link checks and independent disposition.
- `/tmp/pi-toolkit-housekeeping-diagrams-2026-10-12/`: latest `lead-final-source-hashes.json`, `*.lead-final.html`, static/endpoint/link receipts and independent disposition. Earlier builder `final5` copies are historical, not the latest lead identity.
- `/Users/sebastianstrandberg/artifacts/pi-toolkit-six-phase-activation-20261012-034343/`: activation preimages/backup manifest, rollback context, installed discovery and 233-test evidence. Reconcile newer docs against those manifests rather than assuming every current file still matches an older activation receipt.

`/tmp` evidence is not durable storage; check existence before reuse. Its absence is a missing receipt, not permission to recreate results or delete surviving records. Keep new task evidence outside the candidate where practical, with durable outcome pointers.

Known Munin checkpoint (project `pi-toolkit`): `b553c490-5ae3-466e-b246-5c86522383d1` housekeeping diagrams/acceptance. Use `munin recall "reproducible baseline housekeeping activation" -p pi-toolkit` for related records; inspect returned records and current state before reuse.

## First steps and completion criteria

1. Load this handoff and applicable rules; inspect current HEAD/index/status, intended source/dependency paths and available acceptance receipts. No raw session-history sweep or blanket historical log ingestion.
2. Establish a valid relevant pre-edit baseline using project rules. Prefer existing isolated fixtures and loader checks; inspect harness side effects rather than assuming every command is safe. Do not exercise real providers or panes. Preserve true exits, positive counts, skips and source identity.
3. Draft the included-source versus generated/evidence classification. Confirm that a fresh candidate has every runtime import, bundled fixed role, installer source, skill-relative reference, optional resource, license and provenance needed. Do not automatically package external diagram-design tooling or machine-local overrides.
4. Implement narrow ignore rules only after classification; exercise representative included/excluded paths, including untracked accepted code/docs and retained evidence. No deletion or relocation.
5. Build the isolated clean candidate from explicitly reconciled source. Run the existing integrated suite, source/reference checks and fake-HOME installer conflict/idempotence/resource-loading checks on **that** candidate. A live-worktree pass or existing symlink is not clean-candidate proof. Do not widen validation into personal installation/provider calls. Use the HomeLab skill if browser/container environments are actually necessary; no new setup without applicable authority.
6. Inspect complete candidate delta and independent review findings; repair in-scope blockers and renew affected checks. Report limitations of environment prerequisites rather than promising a dependency-free clone.
7. Present exact candidate identity, intended versioned paths, exclusions/retained records, test evidence, manual gaps, rollback/recovery pointers and the proposed commit scope. **Stop before committing and ask for that approval.**

## Paste into a new session

> Work on pi-toolkit using the six-phase workflow. Read `docs/maintenance/reproducible-baseline-handoff.md` and continue the approved reproducible-baseline task; do not repeat the completed housekeeping audit. Reconcile current dirty/untracked source and acceptance evidence, add only narrow safe ignore rules, validate an isolated clean candidate with fake-HOME installer/resource checks, and obtain proportionate independent integrated review. Preserve unrelated work, the real index, evidence and personal installation. Own ordinary diagnosis/repair and return the exact proposed commit scope. Do not commit, delete/archive, install/reload, push/publish, change runtime policy, access private data or control applications/sessions.

# Six-phase engineering workflow

The discoverable [addy-engineering skill](../skills/addy-engineering/SKILL.md) adapts Addy Osmani's DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP discipline to Pi. A user can ask for a six-phase/six-step cycle or structured engineering workflow without knowing Addy’s name. It uses the existing model-only worker tools over the [extracted execution service](execution-service.md); it adds no executable extension, worker grant, routing change, scheduler, install flag or default policy replacement.

## PACE: the conversational alias

Say **"let's use PACE"**, **"PACE on the approved plan"**, or **"continue with
pace"** to select this same cycle at its next unfinished phase. PACE is
case-insensitive and refers to the engineering workflow, not execution speed.
It reuses settled context and existing approvals: an approved PLAN normally
continues at BUILD, then VERIFY, REVIEW and SHIP for handoff. It does not restart
planning, invent work after completion, override an explicit hold or expand
commit/installation/private-data/release permissions.

The skill's discovery description and toolkit agent guidance advertise this
alias for newly loaded resources. An already-running session may still have the
old description or previously loaded instructions. If `addy-engineering` was
already discovered there, explicitly invoke it to read the current file:

```text
/skill:addy-engineering PACE. Continue the approved plan from the next unfinished phase, preserving its boundaries; do not repeat settled planning.
```

Conversational PACE remains a workflow selector, not a `/skill:pace` skill. The optional [generalist retrieval setup](generalist-context.md) now supplies a thin `/pace` command that forwards to this same canonical skill.
If the current session did not discover the skill, ask it to read the approved
checkout's `skills/addy-engineering/SKILL.md` explicitly, or select it in a fresh
reviewed session. Do not reload or control an ongoing task merely to refresh
this wording. Native command expansion/current-file loading is tested with a
fixture receiver; natural-language selection and phase judgment are model
behavior, not a deterministic dispatcher or a live-session guarantee.

## What is included

- One adapted active instruction path with autonomous slices and root-cause repair.
- Pinned upstream revision `1be8e34187e34647bb83adc3a1323b26ae6f6abe`, unchanged MIT license, all 25 skills, local/shared references, four personas and six core command sources. [Hash inventory](../vendor/addy-agent-skills/UPSTREAM.json).
- [Explicit override table and on-demand specialist catalog](../skills/addy-engineering/references/pi-adaptations.md).
- [Mapping to current guarded execution capabilities](../skills/addy-engineering/references/execution.md).
- Actual Pi skill-loader and source-integrity tests, plus existing harness fixtures.

The raw vendor tree is reference-only. Never register it as a skills directory, package, extension, prompt source or child agent directory. Its upstream hard approval gates, automatic commits, persona fan-out and mutation experiments are not the adapted workflow. No upstream scripts/hooks/installers are included.

## Entry point and authority

This document is not implementation, private-data or release permission. Default toolkit installation links the adapted skill so Pi can discover it through ordinary native skill loading; it does not install the vendor tree as skills, add a scheduler, reload a running session, or replace old policy. Keep old entry points available and do not load conflicting old engineering workflow instructions for one task.

For open discussion of project or feature ideas, use DEFINE as a lightweight exploration of outcome, options and constraints. When a substantial discussion reaches an understood actionable direction, suggest the cycle proportionately: usually a short PLAN, or Direct BUILD for a small settled change. An explicit cycle request starts in the fitting phase with settled context; after bug diagnosis and potential fixes, that is usually PLAN. A proposed workflow, loaded skill, or brainstorm never turns into implementation authority.

With applicable authority for the opt-in session/task, inspect the fresh live/candidate baseline and any owned ongoing work first. A clear request to run an understood opt-in task is enough; no additional mode/Agreement ceremony. Use a **fresh session**, not an in-place reload of a running task. Check effective instructions and tool requirements together before launch; merely selecting the new skill does not neutralize old project policy or supply missing tools.

### Project-aware entry aid

[The optional entry script](../scripts/addy-start.mjs) is a small CLI aid, not a new extension, approval service or scheduler. It resolves the physical candidate and launch executable, checks relative agent-config paths against the intended child project's cwd, uses the installed Pi context/skill loaders, reports selected context files/hashes, checks known conflicting mandates and native codemode availability, and observes the project's current HEAD and non-ignored Git status. It assumes the installed Pi loader and Git are trusted host components; it does not evaluate project executables or test the trustworthiness of a host installation. It does not load executable extensions, connect MCP, call a model or mutate settings/project files in check mode.

```sh
TOOLKIT=/absolute/path/to/approved/candidate
PROJECT=/absolute/path/to/project

# Read-only preflight. Review the cited context files, not just its exit code.
node "$TOOLKIT/scripts/addy-start.mjs" --project "$PROJECT"

# Once the opt-in session/task is authorized and context is reconciled:
node "$TOOLKIT/scripts/addy-start.mjs" --project "$PROJECT" --launch \
  --task 'Work Direct on the understood task. Acceptance: ... Exclusions: ...'
```

Default output is JSON. Known conflicts return exit 2 and prevent `--launch`; there is no bypass flag or automatic rule edit. The bounded detectors flag the observed legacy mandatory context-mode/takt/repeated-approval forms. They are **not exhaustive semantic policy analysis**: unknown instructions, tool descriptions and grants still need lead inspection. Agent-level SYSTEM/APPEND_SYSTEM and project/ancestor/global context remain relevant; a project override cannot suppress parent/global policy. Projects with `.pi/settings.json`, `.pi/SYSTEM.md` or `.pi/APPEND_SYSTEM.md` are conservatively blocked for separate inspection, rather than silently ignoring required project configuration or trusting executable packages. After resolving such integration needs with applicable authority, use a separately reviewed normal Pi invocation; do not delete files to pass this aid.

`--launch` opens one fresh interactive session with explicit candidate adapter plus `builtin:codemode`, no default extensions/MCP/skills/prompt templates, and the adapted skill. Its initial message deliberately invokes `/skill:addy-engineering` so this narrow launch path has one selected engineering path; ordinary installed Pi sessions can discover the skill natively. No `--no-context-files`, forced system prompt, automatic resume/retry or changed model routing. It preserves configured lead-model choice and fixed worker grants. It does not run project tests or contact/control existing workers/applications. A full effective-loadout check still belongs to the new session before code edits.

`--task` embeds literal text after opt-in prose in that one fixed skill-command message, never shell-interpolated by the aid or treated as a Pi option/`@` attachment. `--task-file PATH` deliberately attaches an existing task file instead; use one or neither, not both. Conversation is sufficient and no task-file suite is required. Without a task, the session selects the workflow but must obtain an understood request before implementation. Advice in a task file does not become execution authority from `--launch`.

**Keep baseline and compatibility separate.** The report's current HEAD/status digest is an observation, not a stored expectation, snapshot or green-test result. Status uses normal Git reporting: ignored changes are absent and untracked directories may be grouped, so its count/digest is not a complete file inventory or candidate identity. Dirty/unborn/non-Git projects do not fail merely because they lack a clean old revision. The lead establishes the new task's required valid baseline under project rules. Do not reuse a historical release's hardcoded HEAD/dirty-status comparison or reset newer work to pass it.

Alternatively, for an already reviewed project/loadout use explicit one-process Pi resources directly:

```sh
pi --no-extensions --extension builtin:codemode \
  --extension "$TOOLKIT/extensions/delivery-tmux/index.ts" --no-mcp \
  --no-skills --skill "$TOOLKIT/skills/addy-engineering/SKILL.md" \
  --no-prompt-templates
```

Then invoke:

```text
/skill:addy-engineering Work Direct on <understood task>. Acceptance: <specific outcome/checks>. Exclusions: <explicit limits>.
```

`--no-skills` avoids automatic discovery of legacy skills; explicit `--skill` still works. In ordinary installed sessions, the skill is discoverable by its description and may be selected for matching six-phase or understood brainstorming requests. Deliberate `/skill:addy-engineering` remains useful when the user wants to select it explicitly. A loaded skill or bare invocation selects guidance, not authority to invent work.

These entry paths preserve context rules while narrowing executable/skill resources. If higher-priority installed workflow rules conflict, resolve them through applicable approved configuration—not a user-prompt override. A project-owned `AGENTS.override.md` can retain legacy behavior for non-opt-in tasks and allow the adapted path when explicitly selected, but adding/changing it needs actual authority and must retain project quality/safety rules. Canonical/symlink imports of this same service share one host instance; different physical source copies are not one instance. Do not load installed and candidate adapters from different copies in one session. Optional specialist tools/skills must be deliberately loaded through a separately reviewed invocation under the adaptation table and current grants.

Default `bash install.sh` links `addy-engineering` under the user’s Pi skills directory using the installer’s existing idempotent/conflict-refusing preflight. It never links the upstream vendor tree, changes settings, reloads a session, or selects a default workflow for every task. An ordinary workflow/task request does not grant release, policy retirement, or application-control authority.

## Verification and honest boundaries

Run repository checks on the approved candidate:

```sh
node --test tests/addy-entry.test.ts tests/addy-workflow.test.ts
node --test tests/*.test.ts
```

The focused suites use the installed Pi resource/context loaders, argument parser and pure skill-command expansion with explicit or test-owned agent paths. They check native discoverability, context override/ancestor/global precedence, known-rule and protected-config blockers, fresh dirty baseline observations, shell-safe literal launch arguments (including leading options/`@` text under Pi's real parser), explicit skill expansion without creating a session, child exits, symlink candidate identity and relative-path/cwd coherence, pinned bytes/reference completeness and installer idempotence/conflicts. Launch tests substitute a fake Pi executable; no real session/provider or project executable is run. The existing integration suite uses fake HOME/tmux and the actual Pi extension loader to exercise guarded service clients. Static wording checks and narrow conflict detectors do not prove semantic compatibility or model compliance. No live pane/product qualification is implied by these fixtures.

For actual work, project rules own commands and quality standards. Review intent, full task delta and evidence; Team defaults to final independent integrated review, Direct/Developer use risk/request proportionate independence. Missing required evidence/review is a gap, not a pass.

## Task startup and concise continuation

Before suggesting follow-up work, read the latest task outcome/handoff and current source state. Identify completed behavior/instrumentation, historical versus current acceptance, actual/reused checks and remaining gaps. Do not duplicate completed work, recast old pending documents as the final status, or equate a scheduling callback/fixture with physical runtime proof.

While choosing validation, identify effects of normal startup: model/cache use, possible downloads/migration, device/permission checks and interaction with a running app. Isolated config/HOME alone is not proof of isolation. Summarize existing authority, intended checks and exclusions in the conversation/issue; ask one concrete necessary permission decision when possible. Offer a separately authorized narrow read-only prerequisite check for unknown readiness instead of asking the user to certify it from memory. No blanket permission or repeated settled approval.

Keep long procedures behind file pointers. User-facing checkpoints should state the useful result, one immediate next action, the exact unresolved permission if any, and honest gaps. Preserve complete logs and diagnostic evidence without repeating a matrix at every turn.

## Activation and useful trial checklist

1. Verify prior/ongoing work is reconciled without controlling unrelated workers/applications. With approved access, inspect the latest outcome and a short retrospective.
2. Obtain applicable authority for the intended opt-in session/task. Recheck source/candidate identities and actual project context/tool compatibility before launch; do not install extraction separately as an implicit prerequisite.
3. Establish the fresh task's ownership and required valid validation baseline, independent of the reusable entry aid. Preserve dirty work and explicit limits.
4. Verify the new session's full loadout: one adapter source, one engineering path, actual project rules, unchanged fixed grants/routing and approved integrations.
5. Run a useful bounded task with realistic authorized runtime acceptance/isolation. The first Dikta trial released v1.5.6; its retro informs the entry refinements, not universal workflow/model qualification.
6. Learn from further useful tasks before proposing default adoption/old-policy retirement. No benchmark project and no artifact cleanup are part of this integration.

Leave artifacts and recovery material intact. No commit/push/publish, installation/reload, app stop or workflow retirement is authorized by these instructions.

# Lean workflows: Direct, Developer and Team

## Purpose and release boundary

Pi should be a proportionate thinking partner, not an automatic Team coordinator. Customer progress is a useful decision or observable outcome, not a count of agents, documents or passing tests. Use existing discussion and inspected evidence, clarify consequential gaps only, and separate purpose from engineering tasks. The thin `agent/AGENTS.md` policy routes richer guidance to one on-demand `skills/discovery/SKILL.md` and the existing `skills/delivery/SKILL.md` Team compatibility entry point.

This guide records the behavioral/document foundation and the dedicated model-only sequential `developer` tool in the opt-in tmux adapter. Developer and Team reuse ONE owned fixed runtime/controller and reserved/active slot; this is not a second scheduler or generic upstream extension. The explicit `--with-progress` option installs one reviewed vendored @pify/todo 0.3.0 controller; `--hide-thinking` merges only hideThinkingBlock:true. See [progress installation and rollback](progress.md). Personal installation, final independent release review, committed-source reproduction, fresh-session readiness and rollback records remain later gates. Do not infer those passes from these documents or static tests.

## Discover only as much as the decision needs

For consequential uncertainty, invoke `/skill:discovery [question]`. State customer outcome, motivation, constraints, exclusions and the decision. Inspect context before asking one consequential question at a time; synthesize rather than repeat a questionnaire. A long or interrupted investigation can save an unapproved draft Brief early.

An experiment needs a decision question, sufficient-evidence criteria, a relevant comparator, exact checks, permitted resources, budget and stopping rule. Obtain applicable approval. At a substantial blocker reconsider necessity, cheaper safe alternatives and whether stopping with uncertainty is more useful than polishing infrastructure. A failed/inconclusive experiment can be a valid result. Park side quests instead of silently expanding scope. For a native-TTS decision, obtain matched Python/native evidence early rather than repairing an elaborate native-only benchmark; this is a sequencing example, not permission to touch an application or play audio.

## Recommend a path; the user selects

- **Direct:** current-agent implementation of a small understood localized change. No mandatory files. A concise concrete proposal, explicit approval and proportionate checks suffice. Existing safety/project rules still apply.
- **Developer:** one bounded builder when separate context helps, normally one compact approved packet. Preserve customer purpose/design, outcome acceptance, scope/exclusions, applicable rules, baseline/workspace, exact checks, permissions, budget and stop conditions. The main agent inspects actual changes/evidence before accepting. Requires the explicit narrow `developer` invocation below, not bypassed or relabeled Team launch controls. If unavailable, explain and recommend Direct or explicitly selected Team instead.
- **Team:** consequential work with dependencies or substantial validation/review. Explicit user selection permits preparation only. Invoke `/skill:delivery [request]`; keep this supported installed name and stable internal APIs, without a second active Team controller. Synthesize Brief/Plan/Agreement, then wait for approval of the actual Agreement before launch.

Recommend one with a brief reason rather than an unexplained menu. Important unresolved uncertainty warrants discovery or a bounded approved experiment, not a premature builder. Team does not imply parallelism.

## Standalone Developer invocation

Prerequisites: explicitly approved installation of `bash install.sh --with-delivery-tmux`, an installed Pi (loader tested with Pi 1.0.4), tmux and a persistent parent session. Keep the checkout in place; load/reload only in an authorized session, never interrupt another live session. Installation is opt-in and settings/conflicting targets are preserved. The default one-shot `delivery_worker`/CLI remains Team-only; it does not expose Developer. If the dedicated tool is unavailable, offer Direct or explicitly selected Team, not a legacy-control bypass.

Recommend Developer with a reason, obtain the user's explicit selection **and approval of the actual bounded task**, then invoke the dedicated model-only tool. No full Brief/Plan/Agreement set is mandatory. A compact approved packet can carry all context inline, with immutable reference metadata:

```javascript
developer({
  selection: "Developer",
  approvalRef: "conversation approval: user selected Developer and approved packet r1",
  packetRef: "task-packet r1, sha256:<actual-approved-content-hash>",
  name: "bounded-fix", // optional, unique within this parent's ownership
  packet: {
    purpose: "Customer outcome, motivation, design reasons and approved references/revisions.",
    scope: "One bounded fix; exclusions, permissions, budget and stopping rules. Commit none unless explicitly approved.",
    allowedPaths: "/absolute/approved/file; explicitly allowed evidence directory, if any.",
    projectRules: "Full applicable rules or accessible absolute paths and exact revisions; child must read them.",
    baseline: "Workspace/git root/branch/revision and unrelated changes to preserve; completed dependencies.",
    validation: "Exact commands, cwd/environment requirements and required evidence/exits.",
    acceptance: "Observable outcome, report contract and parent inspection before acceptance.",
    task: "The explicitly approved implementation task and required source investigation."
  }
})
```

Every listed field is a nonempty string. Unknown fields and role/agent/cwd/tool/grant/CLI/model/thinking overrides are rejected. `name` is optional and bounded to 80 characters. Only the bundled **builder** can launch; Developer cannot launch validator/reviewer. Current parent model/thinking propagate; saved resume replays the unchanged pinned loadout. Allowed paths and scope are **instructions, not an OS sandbox**; the shell/read/write tools are not path-confined.

`selection`, `approvalRef` and `packetRef` are required admission metadata, **not authentication of actual user consent**. The runtime cannot verify a conversation approval, file/hash, reference freshness, semantic packet adequacy or compliance with its paths. The parent must verify the actual selection/approval and exact packet revisions before launch, supply all required rules/context, and stop for missing/stale authority. Tool availability or a declaration alone is not authorization. Team `subagent` remains Team-only under its actual Agreement contract; Developer declarations do not confer Team authority or waive independent Team review.

Results/questions arrive automatically; do not poll or invent results. The parent alone inspects complete actual changes, retained sessions/sidecars/scripts, exact validation logs and outcome fit before explicitly accepting. Worker completion, successful checks and a released slot are not acceptance. Reconcile all owned resources, preserve partial changes/failure evidence, and obtain renewed approval for material scope changes. Real provider demonstrations, independent release gates and personal readiness remain P4/later work; fake transport tests are protocol evidence only.

Use the shared `subagent_message` control with the exact owned name. Matching `runId`/`questionId` answers release waiting only; `pause` retains the pane/session and single slot. Inspect changes/evidence before `rearm` with explicit new work. For any Developer uncorrelated new-work message, rearm or terminal saved resume, repeat the **original** `approvalRef` and `packetRef` (work must remain within that approved packet). Replies/pause/stop need no new-work references and never grant new scope. A material task change requires fresh compact approval and a new `developer` invocation after ownership reconciliation, not changing stored references.

```javascript
subagent_message({ name: "bounded-fix", action: "rearm", message: "Approved remaining work within packet r1",
  approvalRef: "<same original approvalRef>", packetRef: "<same original packetRef>" })
```

Developer and Team deny sibling/overlapping launches in both directions, even before launch awaits. Running/waiting/paused workers hold the slot. Stop, parent teardown and the fixed 20-minute timeout classify cancelled, never successful; failed owned cleanup is retryable and blocks launch. No parent retile or external registry adoption. Branch-owned saved resumes require unchanged pinned grants/resources; unknown/malformed provenance fails closed. Accepted v1 records without workflow provenance remain legacy Team only, never automatic Developer grants. Saved active records with no matching watcher remain unresolved, not silently resumed/released. Fresh independent Team gates are unchanged.

## Team documents and execution authority

Templates are in `skills/delivery/references/templates/` and detailed contracts in `skills/delivery/references/{delegation,authority-and-state}.md`.

**Brief** preserves problem, motivation, intended behavior, chosen-design reasoning, experiment evidence, scope/exclusions and observable acceptance. **Plan** describes approach, bounded ordered tasks/dependencies, validation, budgets, progress and decisions. **Agreement** names exact approved Brief/Plan revisions and establishes permissions, launch mechanism, budgets, stops and explicit commit/install/cleanup authority (otherwise none).

Make actual artifacts available alongside a concise approval summary. Record the exact approval, approver and covered paths/revisions/content hashes or immutable git sources. Team selection, drafts, Brief approval or a high-level summary are not actual Agreement approval. Freeze approved scope or separate progress annotations; verify references before launch. Material purpose, acceptance, scope, design trade-off, permission or budget changes require a revised proposal and renewed approval. Ordinary in-scope edits, checks, debugging and permitted bounded repairs do not require routine reapproval.

The lead owns packets, integration, records, acceptance and resource reconciliation. Supply every builder, no-edit validator and inspection-only reviewer with the full applicable approved purpose/design/acceptance references, experiment results, exact revisions, rules, baseline, allowed workspace and evidence. Name the readers and confirm consumption; a document written but never read is not a handoff. Child discovery denials and fixed grants remain unchanged. Missing/stale context is a blocker, not permission to widen discovery.

Team runs sequential fresh builder -> fresh no-edit validator -> fresh independent inspection-only reviewer. The explicit opt-in visible tmux adapter supports those roles. The legacy default one-shot tool/CLI remains, but exposes builder/reviewer only; supply a separate fresh no-edit validator through an approved supported mechanism or leave the Team gate incomplete. Model/thinking defaults are not changed by guidance. No nesting, arbitrary profiles/tool widening or parallel writers. Shell can mutate files even without edit/write tools; these limits are not an OS sandbox.

Inspect actual complete task-owned changes, including added files, and evidence tied to the same source revision. Review approved customer-outcome fit as well as code correctness. At most two focused fix cycles follow initial implementation, each with fresh checks and complete revised-diff review, within the Agreement's effort ceiling. Missing checks are not passes. Suggestions remain nonblocking follow-ups, not implementation authority. Stop for material choices, missing authority/evidence, uncertain ownership, source drift, exhausted budgets or checks that cannot be resolved within bounds.

## Truthful progress and reconciliation

Use lightweight authoritative Markdown Plan task rows with task/outcome/dependencies, state, approved references/source revision, evidence/blocker/next action and lead acceptance. States are **pending**, **active**, **blocked**, **paused**, **cancelled**, **abandoned** and **accepted**. Retain unresolved work and reasons across retries, cancellation and resumption. Inspect source, evidence and owned resources before resume; never blindly replay.

Worker transport completion, exit zero, testing success or a released worker slot is not acceptance. Only the lead explicitly marks accepted after inspecting acceptance evidence, fresh validation and independent review on the same revision and reconciling owned resources. No invented percentages or elapsed-time completion estimates.

The opt-in @pify/todo 0.3.0 widget is a projection/cache, not a second scope authority or scheduler. The lead maintains its pending/in_progress/completed mapping: accepted alone becomes completed; active becomes in_progress; pending stays pending. Retain unresolved blocked/paused/cancelled/abandoned entries as pending with explicit [blocked]/[paused]/[cancelled]/[abandoned] labels and reasons. The integration excludes the bundled scratchpad skill and installs only the guarded controller. Rebuild/reconcile the view from the applicable Plan on supported reload/branch/compaction recovery. Source review and mock lifecycle/display checks are not live installed readiness. Supported recovery limits are documented in [progress.md](progress.md).

Meaningful default-agent scratch lists need no mandatory Plan for trivial Direct work. Children do not maintain independent task systems. Narrate findings, decisions, blockers and completion, not every tool call. Detailed output stays inspectable via Pi's default Ctrl+O. Thinking visibility (Ctrl+T or hideThinkingBlock) is separate from reasoning/model defaults; The opt-in installer changes only hideThinkingBlock, never reasoning or model settings.

## Safety, lasting records and completion

Trace claims to inspected evidence. Propose changes and await explicit approval; ask before destructive/outward actions unless exact existing approval covers them. Project rules belong in the repository's AGENTS.md. Preserve unrelated changes/settings/resources; no blanket staging, reset, stash, history rewrite or unknown-path cleanup. Installation preserves existing conflicts and installed delivery compatibility targets. Keep unfinished sources isolated from globally symlinked live targets.

Recall relevant decisions with `munin recall "<query>" -p <project>` using the git-root folder name. Lead-owned `munin remember "<summary>" -p <project>` records decisions, outcomes and resumable handoffs without secrets. Keep failed/interrupted records. Authorized successful completion may include descriptive validated commits and exact-owned resource cleanup, but no implied commit/install/push/PR/publish/delete authority. Retain follow-ups, qualifying ADRs and real installation/rollback records before authorized cycle cleanup. ADRs are for consequential architectural decisions, not a file-count threshold; ADR acceptance itself is not implementation approval.

Static/fixture checks demonstrate guidance structure and fake-HOME installer preservation. Model-behavior observations are demonstrations, not universal compliance or customer-satisfaction guarantees. The fresh user usability trial and final lead acceptance remain separate.

## Retained follow-up candidates (not approved implementation)

Each needs demonstrated need, bounded proposal and approval. This list preserves the prior agreed discussion without editing or deleting that summary:

- Selectively maintained durable capability/product specifications for repeatedly changed areas; no whole-product documentation, OpenSpec/Spec Kit adoption or spec-as-source regeneration requirement.
- Structured JSON task state, dependency scheduling and stronger resume automation only if actual machine consumers warrant them; current tracking is one lightweight authoritative Plan plus a projection, not a new framework.
- Custom transcript renderers, richer blocked/paused visuals and worker telemetry if the evaluated widget and existing Pi controls prove insufficient; no custom dashboard now.
- Stronger runtime enforcement of Agreement boundaries, revision pinning and budget checkpoints after observing instruction-based behavior; preserve existing launch/ownership safety now.
- Specialized discovery/experiment agents, extra roles, broader model routing and parallel execution only when separate context demonstrates value; agent count is not success.
- Broader project-rule migrations and stack-specific validation policies after targeted audits; no silent rewrite of Dikta rules or unrelated instructions.
- Extended installer rollback and upgrade diagnostics after actual first-release installation/recovery requirements are met.
- README's deferred **Jev** and **Hermes** work remains deferred; this release does not reopen it.

No mandatory Epic/Feature/Sprint stages, story points, planning-review agents, Scrum/TAKT reconstruction, automatic publishing or broad infrastructure expansion are implied. Inspect community alternatives before proposing new infrastructure.

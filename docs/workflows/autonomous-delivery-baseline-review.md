# Autonomous delivery — Dikta baseline review

**Date:** 2026-10-08. **Status:** Completed read-only analysis; recommendations, not implementation authority. User approved checking the parked job and doing follow-up analysis. No Dikta changes, tests, runtime launches, worker control, installation or model calls were performed here.

Related proposal: [autonomous-delivery draft r2](autonomous-delivery-draft.md). Retained usage and fresh read-only identity checks: [baseline evidence JSON](autonomous-delivery-baseline-evidence.json). The r1 one-pager is historical and is not an acceptance record for this analysis or r2 additions.

## 1. Conclusion

The trial supplies enough evidence to implement a small autonomy revision and then evaluate Scout/model routing. We do not need to finish the migration or run another unchanged Team job first.

The core issue is **how delivery responsibility is allocated**, not simply that the model is too cautious. Narrow packets, blanket failure stops, overloaded reference requirements and impractical role timeboxes repeatedly returned ordinary engineering work to the customer. The lead also spent substantial reasoning/context on coordination. At least one apparent stall included a provider stream error, so not all delay can be attributed to reasoning or prompts.

There is a real implementation/qualification failure as well: the signed exported helper handshakes but cannot complete `describe`. It is unresolved, not evidence of a proven sandbox-denial cause or a failed architecture. Better workflow authority should enable bounded diagnosis and permitted repair; it must not convert incomplete runtime qualification into acceptance.

Preserve the useful safeguards: truthful source-bound evidence, independent validation/review, directly owned resource cleanup, explicit security constraints, and dependency gates. Change which failures trigger agent-owned recovery versus customer decisions, and reduce coordination burden without hiding gaps.

## 2. Parked checkpoint confirmed

At approximately 16:49 WITA, the Dikta terminal reported the job parked and idle, with no delivery worker panes. Its user-approved handoff states D1 was not executed and nothing may resume automatically. A process snapshot showed no matching xcodebuild/xctest/native-helper executable; this is an observation, not continuous absence proof.

- **F1:** accepted for inert signed helper/protocol/lifecycle foundation, not model qualification or a usable native Read Aloud product.
- **S0:** accepted for current browser-safe test-isolation outcomes after builder, fresh validator and independent review completed. Historical timing/read limitations remain explicitly recorded.
- **F2:** protocol/lifecycle subset and one repair delivered; final qualification not accepted. Latest retained signed full suite: **794 total / 788 passed / 6 skipped / 0 failed**.
- **Real qualification:** ordinary archive/export and signatures passed; the exact exported helper handshaked, then `describe` returned a safe failure instead of layout. Child closed and reaped. Heart, network denial and active-inference retirement were not reached.
- **A1/A2/final:** blocked by dependencies, not three additional diagnosed defects.

Fresh analysis-time read-only checks recomputed all **16 task-source after-hashes** with zero mismatches, the exported-helper SHA-256, and all five original approval references. They match the parked evidence. No fresh tests, signing verification or runtime qualification were executed; those outcomes come from retained reports/raw summaries inspected in the session audit.

Key records under `../dikta/docs/delivery/native-kokoro-migration/`:

- `f1/lead-review.md`
- `team-f2-a2/handoff.md`
- `team-f2-a2/approval.json` and `approved-snapshots/`
- `team-f2-a2/evidence/S0/closure/lead-acceptance.md`
- `team-f2-a2/evidence/F2/repair-01/run-20261008T0712/report.md`
- `team-f2-a2/evidence/F2/05-exported-qualification/run-20261008T0753/report.md`

The Agreement/Brief originals retain proposed wording because immutable approval is recorded separately. Do not mistake those headings for missing execution consent; `approval.json` records actual `approve Agreement r1` and exact hashes.

## 3. Customer-intervention evidence

Lead session: `01a11940-7f77-76d7-b131-9880fae9a826`, file `2026-10-08T02-03-39-767Z_01a11940-7f77-76d7-b131-9880fae9a826.jsonl` in the Dikta Pi session directory. References below are JSONL line numbers in the inspected parked file. Times are WITA (UTC+8). Counts are not approval prompts inferred from tool calls.

### Direct / Developer observations

| Event | Evidence | Assessment |
| --- | --- | --- |
| P0 Release command omitted established testability flag | Lead lines 60–69; earlier baseline/retry reports | Preparation mistake. After initial execution approval, separate diagnosis and corrected-command approvals added avoidable friction. Required Release/signing/fixture protections were still appropriate. |
| F1 browser/muter hold | Lead lines 112–127 | Genuine desktop-control risk, and preparation had missed relevant browser paths. Customer action/scope choice was warranted; the extra confirmation after closing browsers was partly a narrowly specified resumption contract. |
| Ordinary signed build to distinguish injected entitlements | Lead lines 146–150 | A reasonable diagnostic inside the signed-helper outcome, but its action-specific authority required renewed approval. |
| Helper-only signing repair | Lead lines 168–169 and F1 lead review | Expected implementation work for the approved purpose. Explicit stop rules prevented ordinary autonomous recovery. Do not retrospectively claim it was authorized before its approval. |

### Team observations after Agreement approval

The inspected lead file contains **seven customer messages after Team execution approval**, including steering/status/parking—not seven independent safety blockers:

| Time / line | Customer involvement | Assessment |
| --- | --- | --- |
| 13:29 / 334 | “run even if brave is open” | The old safety condition genuinely prevented safe continuation. Source-backed test isolation was better than waiving the condition. |
| 13:39 / 351 | Approve S0 isolation change | Material addition to the original allowlist, correctly required approval. The need reveals a missing validation prerequisite, not a reason to ignore safety. |
| 14:19 / 445 | Approve C1 read-only closure | Same-source coverage/reference/timebox recovery. A practical role budget and upfront closure authority could avoid involving the customer here. |
| 15:49 / 522 | Request status and approved continuation | Customer performed workflow steering; the next approved action had not been dispatched. Relevant provider error also exists in this interval. |
| 16:04 / 537 | Ask whether it had stopped | A status clarification, not new scope. Indicates the stopped/running state was not clear enough to the customer. |
| 16:12 / 540 | “continue” | Lead interpreted this as read-only diagnosis; original boundary stop and consumed repair allowance prevented source/runtime continuation. |
| 16:44 / 557 | Explicitly park | Customer decision to stop the trial; not a technical failure. |

D1 was proposed but never approved. It would allow diagnostic edits, a full signed suite/export and one `describe` attempt, then stop again; a functional remedy would need another approval. That is proportionate under the old grant but unsuitable as the default autonomous delivery contract.

## 4. What worked and should remain

1. **Lead resolved a false safety alarm itself.** F2 preflight found background app-family processes; source predicates and fresh NSWorkspace identities showed they were not concrete muter targets. Lead continued without asking the customer to terminate unrelated services. Evidence: `evidence/F2/01-preflight/lead-safety-disposition.md`.
2. **The isolation change removed a real obstacle.** S0 preserved test intent while injecting fakes, and a fresh 784-test suite passed with Brave present. Independent review completed; no live browser automation was used. This is useful environment engineering, not weakened validation.
3. **One repair was genuinely agent-owned.** The F2 shutdown regression triggered the Agreement's already-authorized repair, not another customer approval. Two source files changed, three regressions were added, original assertions remained, and 794 tests passed. Evidence: repair01 report and lead lines 502–511.
4. **Unchanged evidence was reused when explicitly permitted.** Slice05 did not rerun the 794-test suite or reread unchanged authorities wholesale. It checked identity and generated the new ordinary-export/runtime evidence. Evidence: slice05 report and packet.
5. **Failures and ownership were reported honestly.** Failed commands, unperformed gates and historical process limitations were not silently called successful. The failed runtime child was reaped and downstream tasks stayed gated.

These examples show the lead is capable of proportional decisions when its packet gives clear authority. The revision should extend that behavior, not dismantle the gates.

## 5. Main problems, traced to evidence

### A. Failure authority conflicts with the outcome

The Agreement authorizes ordinary debugging, then stops on failed required checks and actual F2 boundary failures; F2 permits only one functional repair. Slice05 explicitly denies source repair. Consequently the first `describe` failure cannot enter a diagnostic-and-repair loop even while meaningful time/launch allowance remains.

**Recommendation:** grant a bounded diagnose → in-scope repair → revalidate path. Keep immediate stops for unsafe effects, lost process ownership, forbidden entitlement/network changes, material architecture decisions and exhausted budget. A failed proof of the intended boundary must block acceptance; it need not always block safe investigation into why it failed. Exact proposed scope remains subject to approval.

### B. The reference and process burden exceeds the role timebox

S0's reviewer was asked to read extensive governing/history/source/raw-evidence material and finish in **three active minutes**. It returned insufficient evidence. C1 then added **15 minutes**, including validator reference closure, reviewer continuation and lead disposition. Its validator checklist contains **19 reference entries**. An approximately four-second nominal timing discrepancy also became explicit closure work.

The missing source/evidence coverage was real and needed completion. The issue is not “accept without reading”; it is assigning an unrealistic workload and turning recovery from that allocation into a customer decision.

**Recommendation:** scope role context to all applicable authority, purpose, acceptance and evidence, with a manageable task-specific reading manifest. Remove irrelevant later-task/history material, not governing constraints. Reuse demonstrably read unchanged context within the same owned session; pass changed inputs explicitly. Give full review coverage a feasible allowance. Separate unresolved outcome/safety evidence from historical process accounting; preserve both without treating every bookkeeping uncertainty as a new feature defect.

### C. Broad inventories confuse source drift with status updates

The S0 acceptance record retains a failed broad-inventory check caused by authorized working-Plan metadata and a path-assumption command error. The lead reconciled the Plan change correctly, but this required extra analysis and continuations.

**Recommendation:** distinguish immutable approvals, task-owned source/build inputs, protected unrelated work, generated evidence and authorized progress records. Check each category with the right rule. Keep meaningful drift protection; do not treat a permitted Plan row update as code corruption. My first audit hash script also assumed a snapshot path for `baseline.json` that did not exist; it was corrected without writes and is recorded in the evidence JSON. This illustrates why tooling errors need proportionate correction, not hidden success.

### D. Lead-side coordination is expensive, and a provider error contributed

For the interval after the repair finished:

- **15:17:43:** worker completion notification.
- **15:23:19:** lead source/result confirmation; completed response reports 5,696 reasoning tokens.
- **15:38:21:** lead error: `OpenAI Responses stream ended before a terminal response event`.
- **15:49:59:** resumed lead response writes qualification packet; reports another 10,071 reasoning tokens. Customer steering arrives at essentially the same timestamp.
- **15:52:24:** next qualification rearm call.

Approximately **35 minutes of wall time** separates repair delivery from the next launch. This includes generation, a provider failure/recovery, coordination and the customer exchange; it is **not** 35 measured minutes of pure reasoning. The source check at 15:23 was real work, not evidence the entire interval was idle.

The lead reached approximately 224K–249K context before the later compaction. Its growing context contains approvals, packets, reports and inspection results from all modes. The terminal cache counter is not unique context or a billed-dollar measurement.

**Recommendation:** compact durable handoffs, bounded evidence admission and lightweight continuation decisions; truthful stage/provider-recovery visibility. Reuse verified state rather than resynthesizing authority each turn. Transport retry must not blindly replay mutating commands: reconcile actual source/resource/evidence state first. No timeout extension or new retry system is justified solely by this trial; retain the current ownership controls.

### E. Real integration feedback came after a broad implementation batch

F2 slice03 introduced asset/engine seams and setup hardening; slice04 added protocol/work-owner/lifecycle wiring. The first ordinary-exported `describe` attempt only occurred after those batches, S0 closure and the shutdown repair. It failed before real asset access/inference.

**Recommendation:** a thinner early slice should establish ordinary export → hello → pinned manifest read → actual layout, including sanitized diagnosis, before larger engine/qualification wiring. Then expand to asset access, Heart inference, denial and active retirement. Some initial infrastructure is necessary; this is not proof every preceding edit was wasted. It is a sequence that could expose a critical assumption earlier.

### F. Diagnostic privacy obscured the stage of failure

`NativeKokoroHelper/main.swift` maps the broad `describe` catch to one manifest failure code. The harness retained frame kind/identity/length but not the one-byte payload. Parent-side manifest validity does not prove helper access; empty sandbox logs do not establish the cause.

**Recommendation:** make fixed-stage/numeric sanitized failure evidence part of the original minimal integration slice and retain bounded protocol payloads safely. Do not add raw paths, user content, arbitrary errors or broad logging. The existing D1 proposal provides a concrete starting point, but it remains unapproved and does not grant a functional repair.

## 6. Model/usage evidence: opportunities, not a benchmark

All **seven Team worker sessions** inspected used `gpt-6.1-sol`; the launch calls omitted model/effort overrides and inherited configured values. The lead used the same model. There was no task-tier model selection trial.

| Retained usage / scope | Lead after Team approval | Seven Team workers combined |
| --- | ---: | ---: |
| Assistant responses | 138 | 273 |
| Tool calls | 116 | 256 |
| Input field | 263,236 | 847,963 |
| Output field | 121,924 | 102,408 |
| Reasoning field | 65,191 | 12,028 |
| Cache-read field | 18,561,280 | 19,351,168 |

The lead accounts for roughly **84% of the reported reasoning field** in this selected Team scope. This supports examining coordination first rather than optimizing only builder execution. It does not establish unnecessary reasoning token by token or a guaranteed saving from changing models.

Fields are sums of retained assistant usage, not billed charges, unique tokens, context maxima or measured model-speed results. Reasoning may already be included in output; do not add those fields as independent cost. Repeated cached input is not the same as newly introduced context. Exact cost and latency comparisons require matched trials and provider-aware measurement.

Retain the user's candidate constraints: no 6.1 Sol defaults and no Astra. Scout/validator 5.4 Mini, builder 5.6 Terra, reviewer 5.6 Sol, with bounded fresh same-role escalation, remain plausible **untested** profiles. Straight extraction should use scripts or reasoning-none; semantic analysis needs appropriate effort. Older does not automatically mean cheaper/faster.

## 7. Evidence-backed implementation recommendation

### Work package A: autonomy and proportionate handoffs

First revise existing lead/builder guidance, discovery/delivery references, task/Agreement templates and guidance tests:

- One approval delegates the applicable development cycle and approved task continuation.
- Distinguish repairable evidence/check failure from authority/security/ownership boundaries.
- Permit relevant diagnostic variants and bounded repair/revalidation; do not require customer approval for an already-covered step.
- Set feasible role allowances and clear total accounting; do not invent precise active-effort evidence from wall timestamps or reset allowances on resume.
- Supply full applicable purpose/rules and task-specific evidence without repeatedly loading irrelevant history. Preserve complete independent source/outcome coverage and existing fixed role grants.
- Distinguish source/approval drift from authorized metadata changes.
- Preserve staged customer acceptance versus engineering acceptance versus release authority.
- Plan meaningful vertical increments and early actual-boundary feedback. Include sanitized diagnostics from the start where failures would otherwise be opaque.

No shared live instruction changes, new framework, permission bypass, global model change or runtime budget alteration are authorized by this report.

### Work package B: fixed Scout and flat role/model routing

Then approve the exact supported runtime changes for a fixed read-only Scout usable during discovery and execution, with bounded supplied context, ownership/slot rules and no nesting. Keep one lead. Evaluate candidate role/model/effort defaults and one fresh same-role escalation within existing budgets; inspect Developer's inherited-model restriction rather than bypassing it. Protect pinned saved sessions and independent review.

For the first acceptance trial, the selected capable profile can receive a complete vertical slice; no junior/mid/senior orchestration tree or parallel-writer mechanism is needed.

### Separate project continuation: diagnose, repair and qualify F2

Keep Dikta parked until the user approves a new bounded continuation. That continuation should cover safe diagnostic instrumentation, diagnosis, ordinary in-allowlist functional repairs and renewed signed/export/runtime qualification, while prohibiting entitlement expansion, architecture fallback and unrelated app control. Preserve all existing final gates and consumed history; any added repair budget must be explicitly granted, not inferred from time remaining.

Do not merely approve D1 and promise autonomy while its terms require another automatic customer stop after diagnosis. Do not revise the original scope silently or relabel the old failure accepted. Root cause, exact remedy and diagnostic scope remain unknown until more evidence is authorized.

## 8. Validation of the revision

Run isolated guidance/launch/recovery tests before any approved installation. Test explicit negative boundaries as well as normal continuation. Then use one bounded real vertical task with a declared finish line:

- Customer can step away after approval; engineering repairs and role transitions occur without routine prompts.
- Applicable tests/environment checks and independent review pass on the final candidate.
- Late repairs cause affected validation/review to be refreshed.
- Scope, data, role, budget, ownership and release boundaries remain respected.
- Status distinguishes active work, provider recovery, lead decision, customer blocker and ready candidate using observed state; no invented progress.
- Record discovery/planning, worker/handoff, repair, validation/review effort and available cost evidence, not just cheap worker tokens.

Compare interruption categories, outcomes and evidence quality, with task/provider/model differences explicit. The current trial is a baseline demonstration, not a controlled proof that any new profile is faster or that prompt changes guarantee autonomy.

## 9. Disposition and next step

**Baseline analysis complete. Dikta remains parked.** No more unchanged trials are needed before preparing exact implementation scope. The r2 proposal's flat orchestration, vertical expansion and role routing direction remains useful; the new priorities are realistic handoffs/reference budgets, early diagnostic boundary slices, source-versus-metadata checks and provider-error-aware status.

Next: present a bounded implementation packet for the approved-choice process, preserving the user's no-Astra/no-6.1-default constraint and keeping installation separate. This analysis is not permission to launch a worker, change active guidance or resume Dikta.

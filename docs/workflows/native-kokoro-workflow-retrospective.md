# Native Kokoro workflow retrospective and improvement agenda

**Snapshot: 2026-10-10, 10:47:08 UTC. Status: run still in progress.**

This document explains the current workflow, what happened during Dikta's K1–K5 migration, and the changes worth applying and testing next. It is not final product acceptance, release approval, or authorization to implement these proposals. The user authorized this retrospective/document; Dikta inspection was read-only, with no worker contact, application control, tests, or configuration changes. Existing dirty work was preserved.

## Executive assessment

The revised workflow successfully enforced meaningful slices, prerequisite acceptance, sequential workers, and independent gates. It found and corrected real lifecycle, ownership, packaging, and notice defects that green tests had missed.

However, **the customer became the continuation mechanism**. A three-cycle repair budget shared across five slices, fixed worker timeouts, narrow experiment grants, and slice-specific human checks repeatedly required another approval to finish the original outcome. The lead generally respected its current Agreement; the Agreement and runtime made ordinary completion unnecessarily dependent on customer availability.

The desired experience is:

> Run autonomously within approved scope and safety boundaries. Implement, diagnose, repair, and verify until a coherent candidate is ready for my manual validation. Interrupt me only for a consequential decision, genuinely new permission, exhausted meaningful overall budget, or demonstrated lack of progress.

More retries alone will not achieve this. Authority, progress criteria, validation planning, context lifecycle, and runtime continuation must agree.

## 1. Evidence boundary and current product state

Primary lead log: `~/.pi/agent/sessions/--Users-sebastianstrandberg-work-git-dikta--/2026-10-09T10-20-20-394Z_01a1202d-942a-75df-bcbe-1a844339c2e8.jsonl`.

Throughout this document, **L<number>** means the physical JSONL line in that file. Analysis freezes lines **1–1454**, through the snapshot above; SHA-256 of that exact byte prefix is `fea9f3438b029b11691f73985b41bb5cd597c3a5405f816f8bcb6659a1646ae9`. Later run events are excluded. Forty-seven retained worker session paths were recovered from the lead's owned-worker metadata. Selected reports and governing records were inspected; this was not an exhaustive independent application/source audit.

Execution approval was October 9 at **10:36:27 UTC** (L45). The snapshot is **24 hours, 10 minutes, 40 seconds later**. Discovery began earlier. Wall time includes customer unavailability/sleep and waiting; it is not active model time.

| Slice | State at snapshot | Evidence/acceptance boundary |
|---|---|---|
| K1 — packaged Heart readiness | Accepted / GO | Signed-helper qualification plus human Heart listening; bounded in-flight SDK-call cancellation claim, not hardware-preemption proof. L224. |
| K2 — Setup and optional voices | Accepted | Installer/source gates, isolated activation/preservation and ten-voice runtime checks, then human listening. L478. |
| K3 — short native reading | Accepted | Ownership/player corrections, silent real service/SDK check, production-player callback and human check. L890. |
| K4 — progressive long reading | Accepted | Chunk/order/ownership/capacity/lease corrections, current packaged runtime and human long-read check. L1219. |
| K5 — native-only integrated candidate | Partial | Cumulative source/notices/docs and current static production packaging accepted. Final runtime/privacy, matched comparator timing, installed/live integration and practical downgrade remain pending. L1408–1453. |

Do not describe K5 or the job as complete. Final feasibility/probing was ongoing, and no shipping authority existed. Retained K1–K4 evidence is not automatically proof of the final K5 runtime or installed candidate.

Sources: [canonical task/Agreement](../../../dikta/docs/delivery/native-kokoro-migration/team-remaining-migration.md), [K5 source handoff](../../../dikta/docs/delivery/native-kokoro-migration/k5-cycle10/lead-handoff.md), [cumulative review](../../../dikta/docs/delivery/native-kokoro-migration/k5-cycle10-review/reviewer-report.md), [static packaging addendum](../../../dikta/docs/delivery/native-kokoro-migration/k5-cycle10-review/packaging-addendum.md).

## 2. What improved and should be retained

### Actual slice boundaries, not a bundled assignment

The previous [Dikta Ultra retrospective](dikta-ultra-retrospective.md) found multiple planned slices bundled into one long builder, with some migration preceding a material qualification decision. This run corrected those behaviours:

| Slice | Fresh primary builder launch | Accepted predecessor before launch |
|---|---|---|
| K1 | L59, Oct 9 10:38 | No predecessor |
| K2 | L235, 12:29 | K1 at L224, 12:26 |
| K3 | L487, 22:41 | K2 at L478, 22:38 |
| K4 | L907, Oct 10 03:48 | K3 at L890, 03:43 |
| K5 | L1225, 09:12 | K4 at L1219, 09:09 |

Saved continuations stayed within their slice. No overlapping owned active/waiting/paused workers appeared in the persisted state transitions; this is log evidence, not an OS-wide concurrency audit. K3/K4 ownership boundaries were explicit in the Agreement. Dependent work remained blocked until prerequisite acceptance.

Prelaunch evidence includes matching installed/check-out delivery and delegation hashes (L49), actual guidance reads, and the missing installed lean-workflows cross-reference being read from the toolkit without installation (L53–59). This run did exercise the revised guidance, rather than merely proposing a compliant plan.

### Independent inspection found genuine defects

Do not remove independent review to reduce cost. Important findings included:

- **K2:** cancellation did not reach owned work; activation could lose optional packs; fail-open root handling, main-actor readiness work, and lease lifetime needed correction. [Initial validation](../../../dikta/docs/delivery/native-kokoro-migration/k2-validation/k2-validator-report.md); L290, L357–370.
- **K3:** readiness leaked leases; stale failure cleanup could stop a replacement request; voice was not frozen at request admission; production interruption wiring was missing or bound to the wrong sources. [Initial review](../../../dikta/docs/delivery/native-kokoro-migration/k3-review/reviewer-report.md); [cycle 6 validation](../../../dikta/docs/delivery/native-kokoro-migration/k3-cycle6-validation/validator-report.md).
- **K4:** decimal splitting, stale task-handle clearing, a 1,024-chunk promise conflicting with 64 helper request IDs, and a terminal/credit lease race. [Initial review](../../../dikta/docs/delivery/native-kokoro-migration/k4-progressive-review/reviewer-report.md); [corrected static review](../../../dikta/docs/delivery/native-kokoro-migration/k4-cycle8-review/reviewer-report.md).
- **K5:** incomplete notices and outdated native-Setup documentation; noncompliant validation output paths and overwritten failure evidence. [Cycle 9 review](../../../dikta/docs/delivery/native-kokoro-migration/k5-cycle9-review/reviewer-report.md).

Green suites were correctly not treated as proof of these scenarios. Preserve effective-host isolation, current-candidate identity, real-boundary checks, explicit exclusions, owned-process cleanup, and final integrated acceptance. Safety/evidence deviations are real findings, even when their recovery should fit preapproved task authority.

## 3. Why the run repeatedly stopped

### The interruption inventory

There were **30 user messages after execution approval**, excluding discovery, Team selection, and initial Agreement approval. These are messages, not 30 distinct blockers. Manual classification against each preceding lead request gives:

| Category | Messages | Lead-log user lines |
|---|---:|---|
| Repair/continuation approvals | 10 | 120, 167, 304, 371, 505, 569, 660, 993, 1243, 1294 |
| Runtime/preparation/discovery/probe approvals | 7 | 438, 742, 787, 1118, 1182, 1420, 1450 |
| Listening readiness/execution logistics | 8 | 216, 219, 471, 834, 852, 861, 874, 1207 |
| Human quality confirmations | 4 | 223, 477, 889, 1218 |
| General continuation | 1 | 82 |

Some grants mixed budget and genuine new permissions, so the categories are not a count of wholly avoidable requests. In particular, a distinct test signing identity/private container and installed/live/downgrade checks deserve explicit boundaries. Audible playback also legitimately needs readiness.

The sum of each preceding lead-text-to-user-response interval was approximately **13.11 hours**; the longest was **5h24m** before K2's replacement runtime approval. This is an observable communication-gap measure, **not exact blocked time, sleep duration, or recoverable speedup**. Work may occur within some gaps, and unresponded requests are not counted. Still, the architecture made customer availability part of the critical path.

### Repair accounting stopped ordinary implementation

The original Agreement provided **three focused cycles across K1–K5**. That ceiling was exhausted in K2, then repeatedly amended through **cycle 10**. Examples:

- K3 stopped at a fake-transport test-pump error: one tick consumed audio but not completion. A tiny test-only correction needed cycle 5 approval (L495–506).
- K5 stopped at a missing `try` in a new test. A one-token correction needed cycle 9 approval and a fresh builder assignment (L1242–1271).
- Actual lifecycle defects required coherent repairs, but the exhausted global ceiling converted each subsequent pass into another customer decision.

These are not ten failed attempts at the same defect, and some counted work was ordinary implementation/test reconciliation. The later record sometimes distinguishes production from test-only cycles, while retaining conflicting historical totals. Do not infer a clean per-defect escalation history from the cycle number alone.

**Direction:** three corrective attempts may be an internal diagnosis/escalation trigger. Three per meaningful slice would be less restrictive than three per job, but neither should make every small implementation fix a customer stop. Avoid three fresh attempts per newly named issue, which can create an unlimited budget. Use coherent repair passes, progress evidence, and a meaningful overall effort ceiling.

### Runtime limits conflicted with assignment allowances

Six workers were cancelled at exactly **1,200 seconds**: K1 initial, two K2 corrections, K3 correction, K4 initial, and K4 correction (L67, 316, 383, 592, 915, 1009). Some assignments had 40–60 minute cumulative grants, yet every run still faced the fixed 20-minute cap.

The source confirms the mismatch: [runtime](../../extensions/delivery-tmux/index.ts) defines `TIMEOUT_MS = 20 * 60 * 1000` and returns the minimum of that and the remaining assignment allowance. Cancellation means neither completion nor no progress. The lead generally reconciled state before continuation; this was good recovery but additional work.

K2 also returned multiple partial checkpoints from the same builder (L244–272). Preparation/base Setup/voice work successively stopped short of the whole slice. This establishes fragmented completion, not a proven model-quality diagnosis.

**Direction:** distinguish task budget, worker execution quantum, and customer waiting. Plan useful checkpoints before forced cancellation; allow reconciled same-task continuation under upfront authority. Retain cumulative accounting and stop on ownership uncertainty/no progress. Do not blindly replay a failed mutation or reset budgets.

### Validation permissions were planned too narrowly

The Agreement already authorized synthetic inference and targeted probes, but later one-shot grants and exhausted deadlines made repaired harnesses and remaining validation require new approvals. Examples: privacy markers invalidated the old assertion (L153–167); a test-container scaffold failed an emptiness guard (L327); `/private/tmp` normalization broke a qualification guard before SDK invocation (L786–788).

Not every repeat was automatically allowed by the actual experiment ceiling. The planning failure was that routine harness correction and bounded diagnostic replacement were not consistently anticipated. K5 comparator readiness and practical rollback feasibility also remained unresolved until the last slice (L1419–1453).

**Direction:** approve a validation envelope upfront: inputs, owned destinations/processes, side effects, bounded corrective reruns, and stop conditions. Check expensive/material prerequisite feasibility early. Ask again only when the remedy crosses that envelope or changes acceptance—not merely because a task-owned harness needs correction.

### Human checks became slice ceremonies

Four listening/quality rounds gated K1–K4. K1 may justify early human validation if the engine decision depends on pronunciation/onset. Optional voices, short-player behaviour and long-reading checks should otherwise be evaluated for consolidation into one coherent manual-validation session.

The clearest friction was **K3's 3.6-second clip**:

1. Readiness requested at 48% output volume (L833–834).
2. A 52% recheck stopped playback and requested readiness again (L851–852).
3. Waiting expired the 10-minute window, prompting another execution grant (L860–861).
4. A 50% recheck stopped playback again (L873–874).
5. A bounded current-volume ceiling finally allowed the clip (L888–889).

No claim is made that unauthorized audio should have played. Exact equality and a wall-clock grant that expired while awaiting consent produced the loop. K4 later used a current-volume ceiling and separate playback window.

**Direction:** internal slice acceptance should rely primarily on engineering gates. Schedule human validation where it changes a consequential decision, otherwise consolidate it at candidate readiness. Announce route/fixtures, use a user-approved safe volume range/current setting without changing settings, and start the execution window when readiness is received. Preserve immediate Stop and privacy boundaries.

## 4. Context and subscription economics

### Usage for this job snapshot

The table includes all retained assistant-response usage in the lead and its 47 owned workers, plus the lead's four recorded compactions. Workers had no recorded compactions in this snapshot. It includes discovery/preparation, failed attempts and continuations, not just approved implementation.

| Scope | Uncached input | Output | Cached reads | Total reported tokens |
|---|---:|---:|---:|---:|
| Lead, including compaction | 1,617,178 | 517,166 | 84,208,640 | 86,342,984 |
| Owned workers | 4,053,801 | 569,044 | 71,914,624 | 76,537,469 |
| **Combined** | **5,670,979** | **1,086,210** | **156,123,264** | **162,880,453** |

There were **617 lead responses**, **1,222 worker responses**, and 47 fresh worker launches: 13 builders, 17 validators, 16 reviewers, one Scout. Resumptions are not additional fresh launches.

Lead input context had a **131,035-token median** and **255,268-token maximum**. Compactions occurred at approximately 66k before execution, then 258k, 265k and 256k (L44, 532, 892, 1228). Later compaction summaries grew to about 24k, 29k and 33k **characters**, not tokens.

The lead used 225 top-level codemode calls; ten top-level tool results exceeded 20k characters. Some initial discovery output was truncated. More importantly, accumulated result text was approximately 1.23M characters, and lead tool-call arguments themselves were substantial: approximately 305k characters of worker packets, 214k of edits, 215k of codemode scripts, and 104k of writes. These categories are not additive estimates of billable tokens or waste; they show that generated coordination material also contributes to growing history.

The live canonical record was only 223 physical lines but included a long historical K3 paragraph and stale counters/headings: it simultaneously referred to seven/eight cycles while K5 progress recorded ten. Compaction cannot turn a contradictory source-of-truth into clean state reliably. Prefer a short current-state section and append-only linked history, rather than repeatedly restating obsolete progress.

### Broader 72-hour audit from this conversation

A separately frozen audit ending **Oct 10 03:13:28 UTC** covered 124 retained Pi sessions across projects. About **64% of cached reads were leads**; requests with at least 128k input context accounted for **46% of cached reads**. There were **547 top-level tool results above 20k characters**, including 294 codemode results. Median first worker message size was 3,940 characters. Some session-level aggregates included history outside the response window; large-output counts and context bands were timestamp-filtered. This is diagnostic sampling, not a matched performance benchmark.

The earlier assistant-only total omitted compaction; that audit found an additional **873,091 summary tokens**. The job-specific table above includes its own summaries. Do not add the two overlapping datasets together.

**Interpretation:** optimize `working context per request × requests per accepted outcome`, not cache hit rate. Cached reads count repeated material, not unique code. Keeping useful cache reuse is desirable. Neither API dollar estimates nor these token totals establish subscription deduction; exact model/reasoning/cache weights remain unverified. Account usage-meter changes are needed for allowance comparisons.

## 5. Target operating model

| Today | Intended behaviour |
|---|---|
| Approve many narrow repairs/checks | Approve outcome, meaningful boundaries and overall effort once |
| Global cycle counter stops a trivial fix | Coherent repairs proceed; repeated failure triggers diagnosis/escalation |
| 20-minute cancellation creates recovery work | Planned checkpoints and reconciled continuation within task budget |
| Customer acceptance gates every slice | Automated internal slice gates; consolidated manual validation where possible |
| Large history is retained until near overflow | Bounded retrieval plus safe context checkpoints |
| Growing canonical history carries stale state | Small authoritative current state, evidence-linked retained history |
| New worker must recover broad history | Fresh slice/independent-role packet with relevant state and exact sources |
| Model cost inferred from token/API estimates | Measure allowance and effort per accepted outcome |

This retains sequential dependency acceptance, independent validation/review, honest gaps, and genuine permission boundaries. “Ready for manual validation” is not “fully accepted” or “safe to ship.” Unattended work must not acquire private/live input, stop installed applications, install/downgrade, publish, or weaken checks without authority.

## 6. Prioritized proposals and tests — not yet authorized

| Priority | Proposed change | Small test and acceptance signal |
|---|---|---|
| P1 | **Goal-driven autonomy and aligned budgets.** Preapprove ordinary in-scope repair/revalidation and reconciled continuation. Use repeated-defect/no-progress signals, not every red check as a new grant. | A bounded implementation fixture encounters a test bug, a real review defect and a worker checkpoint. It finishes its permitted engineering gates without customer continuation; prohibited actions still stop. Runtime tests prove cumulative accounting, no blind replay/reset, and safe waiting/checkpoint behaviour. |
| P2 | **Consolidated manual validation and feasible validation envelope.** Classify true early decision gates; plan comparator/rollback/isolation needs before dependent work. Separate consent waiting from execution clocks. | A multi-slice trial prepares one coherent final manual checklist, with only justified early exceptions. A listening fixture tolerates approved in-range volume drift, never changes settings, and does not expire while awaiting readiness. Unsafe route/input changes still block. |
| P3 | **Lean state and context checkpoints.** Current candidate/authority/blockers/budget/evidence only; historical detail linked. Trial roughly 64–96k working context, compacting at safe accepted/checkpoint boundaries. | Compare preserved decisions and prerequisite recovery, input processed, summary cost, cache misses and accepted quality. Keep full raw history. Do not compact away active-worker questions or ownership. Pi's `reserveTokens` also affects summary limits; `keepRecentTokens` alone is not an earlier trigger. Inspect the implementation before choosing configuration versus a small hook. |
| P4 | **Bounded data admission.** Native codemode filters/aggregates; oversized output provides previews and explicit continuation rather than silently dropping evidence. | Same search/log/report questions answered with smaller admitted output, exact source references, failures/skips/truncation preserved. Complete owned-diff review remains possible. Small reads need no extra wrapper ceremony. |
| P5 | **Retrieval tool trials.** Reuse existing jCodeMunch for symbols/source and Context Mode MCP for logs/documents; inspect versions, data boundaries and freshness first. | Compare against well-filtered native tools on the same artifacts/questions, including later retrieval and edited/uncommitted code. Count indexing, model-assisted summaries, tool schemas, all retrieval turns and latency. Exact source checks agree; no secrets or unintended external transmission. Start coordinator-only; inspection roles receive no general execution grant. |
| P6 | **Session orchestration.** Fresh context for a genuinely new slice/independent role; coherent same-slice repair continues with a compact checkpoint when useful. | Next slice recovers accepted prerequisites without prior transcript replay. Same-slice continuation avoids rediscovery; no overlapping workers, budget reset or lost candidate identity. Avoid a new scheduler/document suite. |
| P7 | **Measured model routing and lightweight usage accounting.** Keep models stable for initial harness comparison; then trial task-appropriate routing. | Record model/reasoning, inputs/cache/output/summaries, launches, repairs, interruptions, duration, accepted outcome and usage-meter change when available. Exact model availability and role capability constraints are verified before allocation. No unsupported quota savings or quality ranking. |

### Tool roles: avoid overlapping installations

- **Native codemode:** deterministic extraction/filtering before context admission; not persistent conversation compression.
- **Context Mode MCP:** candidate for indexing large artifacts and follow-up retrieval. MCP-only must not be assumed to capture sessions or inject post-compaction memory automatically.
- **jCodeMunch:** candidate for symbol/outline/source retrieval. Verify freshness and inspect actual current source/complete relevant changes before edits or acceptance. Optional summarization/embedding paths may have separate data/cost implications.
- **Munin and repository state:** durable decisions/handoffs, with question-driven retrieval rather than broad memory dumps.
- **Compaction:** same-task history reduction; fresh sessions: new-unit isolation. Both need a trustworthy current-state packet.
- **Pi codebase wiki:** park initially. It is an LLM-maintained architecture/history wiki with advertised automatic context injection, not a substitute for a source symbol index. It adds generation/maintenance and another memory layer.
- **pi-code-index:** lighter ctags-based alternative if existing jCodeMunch is unsuitable; do not install both by default.
- **Billion Context:** remains parked unless residual conversation-history pressure warrants it.

The provisional model discussion suggested Terra medium for routine work, Sol medium for difficult ownership/debugging, and narrow lightweight routing where supported. This run used lead GPT-6.1 Sol; workers used GPT-5.6 Sol/Terra with medium/high/low profiles. The nine high-reasoning builder sessions were not matched against medium alternatives. No evidence here proves newer models, higher reasoning, or cheaper-looking models yield better subscription efficiency. The global default does not override fixed worker routing.

## 7. External lessons and evidence limits

Anthropic documents a context → action → verification loop and recommends runnable checks so the agent iterates until they pass. Its current `/goal` feature separates permission handling from a fresh completion evaluator. This supports the design direction, not a claim that copying a Claude prompt will fix Pi's runtime or guarantee success. Retain real permission enforcement and meaningful no-progress/budget boundaries.

References inspected during this conversation:

- [Claude Code agentic loop](https://code.claude.com/docs/en/how-claude-code-works), [goal completion](https://code.claude.com/docs/en/goal), [best practices](https://code.claude.com/docs/en/best-practices).
- [jCodeMunch architecture](https://github.com/jgravelle/jcodemunch-mcp/blob/main/ARCHITECTURE.md), [Pi codebase wiki](https://pi.dev/packages/%400xkobold/pi-codebase-wiki), [pi-code-index](https://pi.dev/packages/pi-code-index).
- [Existing context-efficiency backlog](context-efficiency-backlog.md), including Context Mode MCP-only boundaries.
- Installed Pi `docs/settings.md`, `docs/compaction.md`, `docs/sessions.md`, and model catalog: 272k advertised windows, no inspected global compaction override, and 16,384-token default reserve. Catalog/configuration inspected now is not proof of every historical session's effective settings.
- Munin handoffs `b2afeda1-b5be-4247-ac23-337ec5719540`, `22697f43-2f1e-4f43-9e54-40b3c899f561`, `b067adc4-7de4-4f2d-8ce7-928e25fc6c62`, and subscription discussion `7731f1e4-2b7e-42f3-aaec-db0530508ac4`.

OpenAI Help direct fetches returned HTTP 403. Subscription-weighting statements were based on search-indexed official content, not a verified conversion formula. Publisher token-saving percentages, community model anecdotes and API prices are not acceptance targets or measured allowance savings.

## 8. Next decision and completion addendum

**Recommend Direct** for the toolkit follow-up, starting with P1/P2 authority/runtime/validation planning, then P3/P4 context handling, then bounded P5 retrieval trials. Keep initial model defaults unchanged to make the harness comparison interpretable. Each meaningful implementation or tool/environment change needs its own compact approval; this document grants none. Avoid parallel intervention in the ongoing Dikta job.

When the run actually finishes, add a short dated addendum containing: final K5/whole-job status, remaining required checks and permissions, any further interruptions/cycles, updated usage through the completion boundary, and any changed conclusions. Do not replace this snapshot or silently claim later success. Separate release/deployment work remains outside this retrospective unless explicitly included.

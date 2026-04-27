# Phase 9 — Quality + observability

Drafted 2026-04-27 after the Phase 8 stress test (run
`2026-04-27T09-55-42-774Z`) cleared the token-cost bottleneck.

Before-state from that run: 19/29 tests pass on Challenge 3. Tokens at
completion: ~191k team-wide. Worker turns: 34 (vs 147 pre-Phase-8).
Lead turns: 27. Files were actually written, delegation pipeline holds,
the off-roster `@orchestrator` ghost no longer appears.

Remaining gaps (in order of pain):

1. **Schema drift between lead and worker** — lead designed a
   `res.body.pagination = { total, page, pages }` shape; worker partially
   implemented and tests were updated to expect the new shape against a
   controller still returning the old flat shape. Result: 7+ test
   failures from one un-coordinated change.
2. **Validation regressions slip through** — worker loosened
   `validateQueryParams` while adding `page` support; invalid status,
   sort, limit, offset all return 200 now. Lead never re-validated the
   worker's output against the brief.
3. **No parallelism** — mention chain is strictly serial, so an 8-task
   plan with two independent leaves still walks the queue one mention at
   a time. Wall-time tax that grows with plan size.
4. **Hard-coded 128k context limit** in the 🧠 indicator — fine for
   minimax m2.5 / ling-2.6-flash today, lies for Claude / Gemini 1M.
5. **Tool-call activity is invisible** — workers spend turns running
   `read` and `bash`; the harness shows nothing in the till-done pane
   between dispatch and `done:`. Opaque.

This plan addresses 1, 2, 5, and 4. Item 3 is real but speculative
without a multi-leaf plan in hand — defer until a workload demands it.

---

## Track A — Validate-before-report (do for sure, ~45 min)

The cheapest fix for both schema drift AND validation regressions: make
the lead actually run its own validation step before emitting `done: t<N>`.
Today the lead reports done as soon as its worker writes; nothing gates
that on the controller still matching the brief.

### A1. Lead-level test runner mention (~20 min)

**Files:** `harness/agents/leads/generic-lead.md` body, plus a
prompt-snippet describing the contract.

After every worker `done:` reply, the lead should:

1. Re-read the file the worker touched.
2. Diff against the brief mentally — does the response shape match?
   Are validation rules intact?
3. If a test or run-step is plausible, dispatch a verifier mention back
   to the same worker (or a sibling) asking: "run `npm test` and reply
   with the count of pass/fail; do not modify code."
4. Only emit `done: t<N>` once the verification mention returns clean.

This is purely a prompt change — no harness code. Workers already have
bash; leads can already chain mentions.

### A2. Reviewer worker (~25 min)

Optional but bigger payoff. Add a third-tier role
`harness/agents/workers/reviewer-worker.md` whose job is:
- read the modified files
- read the original brief from the lead's mention
- emit a structured `findings:` block with `regression`, `schema-drift`,
  or `ok` for each item

Wire it up in `team-shape.yaml` under `minimal-trio` as an optional 4th
member; the orchestrator and lead see it on the roster but don't have to
use it. Then the lead's prompt change in A1 references the reviewer
explicitly.

This costs one extra rpc subprocess per run (~free under Phase 8) and
roughly doubles wall time per task — acceptable in exchange for catching
the schema-drift class of bug.

---

## Track B — Tool-call event surfacing (~30 min)

The `onToolEvent` slot was reserved in Phase 8's `SendOptions` but never
fired. Wire it up.

### B1. Forward `tool_execution_*` events from agent-process.ts (~10 min)

**File:** `pi-team/src/agent-process.ts`. In `handleEvent`, branch on
`event.type === "tool_execution_start" | "tool_execution_update" |
"tool_execution_end"` and call `turn.onToolEvent?.(event)` if set.

Add `onToolEvent?: (event: ToolEvent) => void` to `SendOptions` (it's
already mentioned in PHASE-8-PLAN.md as a reserved slot).

### B2. Status line per active agent (~20 min)

**File:** `pi-team/src/panes.ts`, `TeamFooter.renderRoster`.

Track a per-role `currentTool: string | null` map in the harness state.
Update from `runMentionChain`'s `onToolEvent` handler:
- `tool_execution_start` → set `currentTool[role] = toolName + " " + briefArgs(args)`
- `tool_execution_end` → clear

Render below the role row when set, like:

    ⚡ @frontend-worker 86k↑ 2.5k↓ 🧠 89% free $0.00
        ↳ bash · npm test --silent

Falls away cleanly when nothing is running. Implements the same "I can
see what the worker is doing" UX as Dan's reference video.

---

## Track C — Per-model context limits in team.yaml (~15 min)

**Files:** `pi-team/src/team-config.ts`, `pi-team/src/agent-def.ts`,
`pi-team/src/panes.ts`.

Replace the `DEFAULT_CTX_WINDOW = 128_000` constant with a lookup:

```yaml
# .harness/team.yaml
models:
  orchestrator: opencode/nemotron-3-super-free
  ui-lead: opencode/minimax-m2.5-free
  frontend-worker: opencode/ling-2.6-flash-free

context_windows:           # optional, falls back to per-model defaults
  ui-lead: 200000
  frontend-worker: 128000
```

If absent, look up by model id from a small built-in table (free-tier
opencode models all in the 128k–200k range; Claude 200k–1M; Gemini 1M).

Plumb the per-runtime ctx into `panes.renderRow` so the 🧠 N% free uses
the right denominator per agent.

This is the smallest item in the plan — do last, just to clean up.

---

## What's NOT in this phase

- **Parallel mention dispatch** — wait until a real workload exposes
  the serial bottleneck. The current 8-task plans are linear chains.
- **Compaction tuning** — `set_auto_compaction` defaults are fine until
  a worker actually overflows in a stress test.
- **Cross-run process pool / daemon** — out of scope; each `pi-team`
  invocation owns its rpc children.
- **Worker worktrees / scope ACL enforcement** — old §7 follow-ups,
  defer until frontier model still violates scope.

---

## After Track A + B + C: stress test 4

Same Challenge 3 prompt, sandbox reset, `pi-team`. Target:

1. Test pass rate ≥25/29 on minimax/ling free tier (matching Phase 1
   single-Qwen baseline).
2. Tool-call status line visible during worker dispatches.
3. 🧠 N% free shows correct denominator per agent (verify by making
   ui-lead read a 50k-token file and watching the % drop linearly to
   ~75%, not ~60%).
4. Token spend stays under 250k for the run.

If 1 fails on free models but the schema-drift / validation classes of
bug are gone (per a manual diff review), that's still a Track-A win and
the residual is small-model reasoning ceiling. Frontier model retry then
becomes the natural next signal.

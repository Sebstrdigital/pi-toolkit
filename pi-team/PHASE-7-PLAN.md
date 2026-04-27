# Phase 7 — Post-stress hardening

Drafted 2026-04-27 after Challenge 3 stress test in pi-sandbox.
Run produced no code: lead refused to dispatch via plain-text `@<worker>`,
worker never spawned, till-done flipped 3/7 ✓ on tasks where nothing was
written. Harness routed end-to-end without crashing — the bugs are
prompt + state-machine, not architecture.

This file is the resume point if the session restarts. Read it,
read `team-harness-plan.md` §7 (existing follow-ups), and pick up at
Track A.

---

## Track A — Bugfixes (do for sure, ~30 min)

### A1. Plan immutability  (~5 min)
**File:** `pi-team/src/pi-team.ts` — the `plan` tool's `execute` function.

**Bug:** `plan(...)` calls `tillDone.clear()` and re-seeds unconditionally.
When the orchestrator re-calls `plan` mid-run, all in-flight progress is
wiped (verified: `[2/7]` reverted to `[0/7]`).

**Fix:** Reject the second call if the till-done already has items.

```ts
if (harness.tillDone.all().length > 0) {
  return {
    content: [{ type: "text", text:
      "plan() already registered. The plan is immutable for this user request — call mention(taskId=...) on the existing tasks. If a task is wrong, complete or fail it via mention and explain in your final reply."
    }],
    details: null, isError: true,
  };
}
```

Was follow-up #9 in `team-harness-plan.md` §7.

---

### A2. Honest till-done state  (~10 min)
**File:** `pi-team/src/pi-team.ts` — `runMentionChain` function, near the
bottom of the loop.

**Bug:** Today every clean mention exit auto-flips its task to `done`,
regardless of what the agent actually said:
```ts
for (const id of parsed.doneIds) state.tillDone.markDone(id);
if (item.tillDoneId) state.tillDone.markDone(item.tillDoneId);  // ← this line
```
The second line is the false-positive source. Result in stress test:
7/7 ✓ with zero files touched.

**Fix:** Only mark `done` on an explicit `done: <id>` in the agent's
reply. If the mention exits without one, leave the task `in_progress`.

Replace the trailing `if (item.tillDoneId) state.tillDone.markDone(...)`
block with: nothing. The `for (const id of parsed.doneIds)` line above
already handles the explicit-done case. The implicit fallback is what's
lying.

Add a complementary hard rule to the worker / lead prompts (see A3): "if
you cannot complete the task, reply `escalate <to>: <reason>`. The
harness will flip the task to `failed`." Wire `escalate <to>:` parsing
in `router.ts` to flip the corresponding till-done item to `failed`.

---

### A3. Lead prompt hardening  (~15 min)
**File:** `harness/agents/leads/generic-lead.md` body (not the runtime
suffix).

**Bug:** Free-tier minimax says verbatim *"I don't have delegation
capabilities in this environment - I only have read access"* despite the
runtime roster prompt explicitly saying `@<worker>` is plain text. The
suffix is too far down — the model anchored on the body text "tools:
[read]" and concluded it can't dispatch.

**Fix:** Bake the worked dispatch example directly into the agent body.
Blunt language. Positive example.

Add a section after "## Vocabulary you use" in `generic-lead.md`:

```markdown
## How you dispatch to workers (this is critical — read it)

You do NOT have a tool for addressing other agents. Addressing is plain
text. To dispatch a task to your worker, just write a line in your
reply that starts with `@<worker-role>` followed by the task body.

You CAN do this. Try it. Example reply:

    I have read src/controllers/tasks.js. Here's what needs to change:
    <findings>

    @frontend-worker Please apply the following change to
    src/controllers/tasks.js, lines 51-54:
    <exact diff>
    Reply 'done: t3' when written.

That `@frontend-worker` line is plain text. The harness reads your
reply, finds the `@<role>` line, and routes everything after it to the
worker's session. Do NOT ask the orchestrator for a write tool — you
do not need one. Do NOT say "I don't have delegation capabilities" —
you do, the capability is plain text dispatch.
```

Mirror a smaller version in `harness/agents/orchestrator.md` so the
orchestrator knows it can also fan out directly to a worker if the lead
isn't responding (`mention(to: "frontend-worker", ...)`).

---

## Track B — Visual polish (~60 min, optional)

Do AFTER Track A if there's time and a frontier model isn't ready yet.
Skip if the next stress test is queued — polish a working harness, not a
broken one.

### B1. Roster + till-done styling  (~30 min)
**File:** `pi-team/src/panes.ts` — `TeamFooter.renderRoster` /
`renderTillDone`.

Match Dan's UI from the screenshots taken 2026-04-27:
- Tier icons: `⚡` orchestrator, `◆` lead, `◇` worker
- `⚡` marker next to the *currently-active* agent (one that's mid-mention
  this turn). Track via a `Set<string>` of active roles updated in
  `runMentionChain` before/after `sendToAgent`.
- Inline `$cost` per row (already shown but small)
- `🧠 <ctx tokens>` per agent, using `runtime.usage.contextTokens` which
  is already tracked in `agent-process.ts`
- Till-done items: ellipsis-at-panel-width truncation (already partly
  done after the crash fix), grouped/indented by owner tier

Was follow-up #8.

### B2. Lightweight chat restyle  (~30 min)
**File:** `pi-team/src/pi-team.ts` — `renderTranscript` function.

Match Dan's chat layout (image 40 from the 2026-04-27 conversation):
colored agent-name header line + colored `│` gutter down the left side
of each transcript section. Stays inside pi's tool-result block.

```ts
function renderTranscript(items: ChainTranscriptItem[]): string {
  return items.map((it) => {
    const colorForRole = /* pull from theme based on tier */;
    const badge = `${colorForRole}■ @${it.to}${reset} (from @${it.from})`;
    const gutter = `${colorForRole}│${reset} `;
    const body = it.text.trim().split("\n").map(l => gutter + l).join("\n");
    return `${badge}\n${body}`;
  }).join("\n\n");
}
```

Was follow-up #7-lightweight.

---

## Deferred (untouched in this phase)

- **#6 Persistent agent processes** — real perf win, real refactor.
  Needs context-full detection per agent. Wait until a run actually
  times out from spawn overhead.
- **#7-heavy Custom chat UI** — circle back if Track B doesn't get
  close enough to Dan's look.
- **Real scope ACL enforcement** — frontier model + prompt rule should
  hold for v2 stress tests.
- **Dependency graph between plan tasks** — orchestrator can serialize
  via mention order today; not blocking.
- **Expertise files** — Dan's `expertise:` YAML scratchpads.
- Original §7 items: worker worktrees, scope-violation logging,
  file-based till-done, harness slash commands.

---

## After Track A: re-run stress test

Same Challenge 3 prompt. Look for:

1. Worker session file appears in `.harness/runs/<id>/sessions/` —
   means dispatch finally worked.
2. Till-done items only flip `✓` when worker writes `done: <id>`.
3. Files in `src/controllers/tasks.js` actually changed.

If 1 and 2 pass but 3 still doesn't (worker writes nothing), the
remaining issue is small-model reasoning, not harness. Wait for
frontier model.

If 1 fails (lead still says "no delegation"), A3 needs to be more
aggressive — possibly inject a few-shot example in the FIRST turn's user
prompt itself, not just the system prompt.

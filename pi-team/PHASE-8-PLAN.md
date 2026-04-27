# Phase 8 — Persistent agent processes (RPC mode)

Drafted 2026-04-27 after Challenge 3 stress test #2 (post Phase 7 A+B).
Run produced ~2M input tokens with frontend-worker spinning to 147 assistant
turns vs ui-lead's 9. Worker output: a single edited file.

The per-turn cost shape is the bug:

    sendToAgent (today) =
      spawn `pi --mode json -p --session <file> -c <prompt>`
      → pi reads session.json from disk
      → pi sends entire conversation as input to LLM
      → assistant turn streams back → pi exits
      → next call repeats from disk

So every turn pays full session-replay input cost. Worker at turn 147
sends turns 1..146 + new prompt as input. That's quadratic.

Pi already exposes `--mode rpc` — a JSONL stdin/stdout protocol where one
long-lived process holds session state in memory and accepts `prompt`
commands over stdin. Switching to it makes per-turn input cost linear in
the new prompt + the model provider's prompt cache hit (which actually
works across requests within a single process for Anthropic / OpenAI, and
trivially for OpenCode-routed free models that proxy through providers
that cache).

---

## Architecture change

**Before:**

    AgentRuntime { def, sessionFile, turns, usage }
    sendToAgent(rt, opts) → spawn pi -p, await close(), return text

**After:**

    AgentRuntime { def, sessionFile, turns, usage,
                   proc, stdin, stdout, pendingTurn, ... }
    sendToAgent(rt, opts) →
      if !rt.proc: spawn `pi --mode rpc --session <file> [prompt-args]`
      write {"type":"prompt","message":opts.prompt} to rt.stdin
      consume events until agent_end → return text

Process lifecycle: lazy-spawn on first `sendToAgent`. Tear down on
`team-down` command or harness session_end. If process dies mid-run, log
stderr, mark current send as failed, respawn lazily on next call.

Session file stays on disk via `--session <path>` so post-run inspection
keeps working. Pi writes the session jsonl as it always did; we just
stop spawning a fresh process to read it.

---

## Tasks

### 8.1 Rewrite agent-process.ts to RPC mode (~45 min)

**File:** `pi-team/src/agent-process.ts` (full rewrite of `sendToAgent`,
keep `makeRuntime` + `AgentRuntime` shape extended).

Changes:

- Add fields to `AgentRuntime`:
  - `proc: ChildProcess | null`
  - `stdinBuf: NodeJS.WritableStream | null`
  - `stderrBuf: string` (rolling, last 4kB)
  - `currentTurn: { resolve, reject, textChunks, onTextDelta, onStderr } | null`
  - `eventBuffer: string` (jsonl framing)
- New internal `ensureProc(rt, cwd)`: if no proc, spawn pi rpc with
  `--mode rpc --session <file> --no-extensions --no-skills --no-context-files
   --no-prompt-templates --thinking off --tools <…>` plus, on first spawn,
  `--append-system-prompt <tmpfile>`. Wire stdout JSONL parser, stderr buffer,
  and `close` handler that nulls `proc` and rejects any current turn.
- `sendToAgent(rt, opts)`:
  - `await ensureProc(rt, opts.cwd)`
  - reject if `currentTurn` already set (no concurrent prompts per agent)
  - write `{"type":"prompt","message":opts.prompt}\n` to stdin
  - return promise resolved on `agent_end`, rejected on process exit /
    `error` event
  - while running: feed `text_delta` events to `opts.onTextDelta`,
    update usage on `message_end`, surface `tool_execution_*` deltas via
    optional `onToolEvent` (new) so the harness panel can show "@worker
    using bash: …".
- New `closeAgent(rt)`: write `abort` then SIGTERM after grace period,
  null out proc fields. Used by `team-down` and process exit.

Backward compatibility: `SendOptions` / `SendResult` keep their shape so
`runMentionChain` doesn't change. Add optional `onToolEvent` to
`SendOptions` for the future tool-call UI surface — not wired this phase.

### 8.2 Plumb close() through team-down + harness shutdown (~10 min)

**File:** `pi-team/src/pi-team.ts`.

- On `team-down` command: `await Promise.allSettled(harness.subagents.map(closeAgent))`.
- On `session_end` or process exit: same. Add a `process.on("exit"|"SIGINT"|"SIGTERM")` hook in `bootHarness` to best-effort kill children so a Ctrl-C in pi-team doesn't leave dangling pi rpc subprocesses.

### 8.3 Handle extension UI requests over RPC (~10 min)

Pi rpc emits `extension_ui_request` for things like permission prompts.
For headless agents we have no human to ask. Auto-respond:

- `confirm` → `{confirmed: false}` (deny dangerous-command prompts)
- `select` → `{cancelled: true}`
- `input` / `editor` → `{cancelled: true}`
- fire-and-forget (notify, setStatus, setWidget…) → ignore

Workers should not be triggering permission prompts often (their tool
allowlist is locked at spawn), but a stray bash with a danger pattern
would otherwise hang the run forever. This makes the RPC client
self-driving.

### 8.4 Adjust contextTokens read (~5 min)

`message_end.usage` in RPC mode has the same shape as today, so the
existing `runtime.usage.contextTokens = msg.usage.totalTokens || …`
stays. Also opportunistically issue `get_session_stats` after each turn
(or every N turns) to populate the "🧠 N% free" footer with real
`contextUsage.percent` instead of the 128k-divisor approximation. Defer
this to next phase if it adds complexity — we already have a working %.

---

## What's NOT in this phase

- **Compaction control** — let pi auto-compact at threshold; do not call
  `compact` explicitly. Revisit if context overflow shows up in stress test.
- **Steering / follow-up queues** — single-prompt-at-a-time per agent is
  fine for the current mention-chain pattern.
- **Tool-call event surfacing in the UI** — the wiring point is reserved
  (`onToolEvent`) but the panel render is a Phase 9 item.
- **Process-pool reuse across runs** — each `pi-team` invocation spawns
  its own pi rpc children; on exit they die. Cross-session reuse is a
  separate, larger ask (would need a daemon).

---

## After 8.x: re-run stress test

Same Challenge 3 prompt. Look for:

1. Total token spend cut by ≥5× (target: under 400k for the same task,
   vs ~2M today).
2. Worker turn count drops (less re-explore loops, since the worker keeps
   its file-read context across turns).
3. End-to-end wall time drops (no per-turn pi cold-start).
4. `.harness/runs/<id>/sessions/<role>.json` still complete and inspectable.

If 1–3 pass: this is the unlock. Move on to Phase 9 (tool-call event
surfacing, real per-model context limits, dependency graph between
plan tasks).

If a worker process crashes mid-turn: respawn on next mention call,
existing session file resumes the conversation. No correctness loss.

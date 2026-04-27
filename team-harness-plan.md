# pi-team — Implementation Plan

Status: **draft for review** — not yet started.
Builds on: `team-harness-concept.md`, `team-harness-layout.md`.
Replaces: the human-relay flow described in `team-harness-layout.md` §5 and the obsolete `<project>/.harness/runs/` bootstrap (torn down 2026-04-27).

---

## 1. Goal

Build `pi-team` — a pi extension that brings up Dan-style multi-team agent harnesses inside any pi session. Single command (`/team-up`), three-pane TUI (chat / roster / till-done), `@mention` routing, per-agent cost and token tracking, persistent agent expertise files. The orchestrator is the only entry point for the human; sub-tier agents are addressed by the orchestrator (and leads) through `@mention`.

---

## 2. What pi already gives us

After reading `~/.nvm/.../pi-coding-agent/docs/extensions.md`, `tui.md`, `examples/extensions/subagent/`, `commands.ts`, `overlay-test.ts`, and `event-bus.ts`:

| Capability | Pi API | Used for |
|---|---|---|
| Slash commands | `pi.registerCommand("team-up", { handler })` | `/team-up`, `/team-down`, `/team-init` |
| Full TUI takeover with focus + input | `ctx.ui.custom((tui, theme, kb, done) => Component, { overlay: true })` | Three-pane harness UI |
| Subagent spawning with streaming + cost/token tracking | `examples/extensions/subagent/index.ts` (987 lines, working) | Per-agent isolated pi processes |
| Inter-component events | `pi.events.on("@mention", ...)` / `pi.events.emit(...)` | Message-bus routing between agents |
| User prompts | `ctx.ui.select / confirm / input / notify` | `/team-init` interactive bootstrap |
| Session lifecycle hooks | `pi.on("session_start", ...)` etc. | Boot-time team detection |
| Session-persisted state | `pi.appendEntry(...)` | Run history, chat log |

**Implication:** the runtime model is simpler than I'd framed. Each agent is a spawned pi subprocess with its own session file (the subagent example is the template). The chat-room is in-process state inside `pi-team`'s overlay component. Routing is just function calls inside the same process. We do not need a separate message-bus daemon.

---

## 3. Architecture

```
   ┌──────────────────────────────── pi-team extension ─────────────────────────────────┐
   │                                                                                    │
   │   /team-up handler                                                                 │
   │       │                                                                            │
   │       ├─ load .harness/team.yaml                                                   │
   │       ├─ load harness/agents/*.md (system prompts) + harness/teams/<shape>.yaml    │
   │       ├─ for each agent:                                                           │
   │       │     spawn pi subprocess (isolated session, system prompt seeded)           │
   │       │     register agent in roster + chat-room state                             │
   │       └─ ctx.ui.custom(HarnessOverlay)                                             │
   │                                                                                    │
   │   HarnessOverlay (full-screen)                                                     │
   │       ┌─────────────── Chat pane (scrolling) ────────────────┐                     │
   │       │  System: Your Agent Teams (tree)                     │                     │
   │       │  You: <human input>                                  │                     │
   │       │  Orchestrator: I'll do X. @ui-lead ...               │                     │
   │       │  ui-lead: 967 lines, valid SFC. ...                  │                     │
   │       └──────────────────────────────────────────────────────┘                     │
   │       ┌── Roster (cost/tokens/tree) ──┐ ┌── TillDone [3/8] ──┐                     │
   │       │ Orch         $0.85   943K     │ │ ✓ ...              │                     │
   │       │ ├ ui-lead    $0.69  941K      │ │ ● ...              │                     │
   │       │ │ └ worker   $0.43   86K      │ │ ○ ...              │                     │
   │       │ ...                           │ │ ...                │                     │
   │       └───────────────────────────────┘ └────────────────────┘                     │
   │       ┌─────────────── Input ─────────────────┐                                    │
   │       │ > _                                   │                                    │
   │       └───────────────────────────────────────┘                                    │
   │                                                                                    │
   │   Routing                                                                          │
   │       human input ──▶ orchestrator subprocess (stream stdout)                      │
   │       parse stream for @<role> mentions                                            │
   │       on @mention: route remainder of message to that agent's subprocess           │
   │       on `done: <id>`: update till-done                                            │
   │       on tool reports / cost reports: update roster                                │
   │                                                                                    │
   └────────────────────────────────────────────────────────────────────────────────────┘
```

### Process model

- One pi subprocess per agent, started at `/team-up`, persisted across the run via session files.
- The `pi-team` extension itself runs inside the user's primary pi session and orchestrates the subprocesses.
- Subprocesses live as long as the harness is up. `/team-down` (or session end) tears them down.
- Each subprocess's session file lives under `.harness/runs/<run-id>/sessions/<role>.json` so a run can be resumed.

### `@mention` routing

- Each agent's system prompt teaches it: "address another agent by writing `@<role>` followed by your instruction in plain text."
- `pi-team` parses every line of stream output for the regex `@(\w[\w-]*)` and dispatches the rest of the line (or message) as input to that agent's subprocess.
- Vocabulary (`done:`, `report ...:`, `escalate ...:`) is parsed for state changes (close till-done item, surface to user, halt).
- Same routing applies to all tiers: orchestrator → lead, lead → worker, worker → lead, etc. The router doesn't care about tier — it just follows the `@`.

### Vocabulary correction (urgent fix)

From the screenshots, the actual delegate format is `@<role-name> <free-text task>`, **no colon, no `delegate` keyword**. The colon is reserved for `report`, `done`, `escalate` (status verbs that don't route). Current `harness/vocabulary.md` and the agent prompts say `delegate <to-role>: <task>` — this is wrong and gets fixed in Phase 0.

---

## 4. File layout

```
pi-toolkit/
├── harness/                          # SHARED (already scaffolded — fix vocab)
│   ├── agents/
│   ├── expertise/templates/
│   ├── teams/minimal-trio.yaml
│   ├── vocabulary.md                 # FIX: @mention syntax
│   └── README.md
│
├── pi-team/                          # NEW — the extension
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                  # entry; registers /team-up, /team-down, /team-init
│   │   ├── boot.ts                   # team.yaml + harness/ → spawn N pi subprocesses
│   │   ├── router.ts                 # parse stream, route @mentions, parse vocabulary
│   │   ├── till-done.ts              # state machine for the till-done list
│   │   ├── roster.ts                 # per-agent cost/token tracking
│   │   ├── overlay/
│   │   │   ├── HarnessOverlay.ts     # top-level Focusable, owns layout
│   │   │   ├── ChatPane.ts
│   │   │   ├── RosterPane.ts
│   │   │   ├── TillDonePane.ts
│   │   │   └── InputPane.ts
│   │   └── persistence.ts            # write/read .harness/runs/<id>/*
│   └── README.md
│
└── (existing pi-roles, pi-chains, pi-ui untouched)
```

---

## 5. Phases

I'm writing this. The user is reviewing. Phases are ordered for **incremental visible progress** — every phase produces something that runs.

### Phase 0 — Vocab + prompt corrections (~10 min)
Fix the existing `harness/` scaffold to match the real `@mention` syntax. No new code.

- Update `harness/vocabulary.md`: replace `delegate <to-role>: <task>` with `@<role> <task>`. Keep `report`, `done`, `escalate` colon-style.
- Update `harness/agents/orchestrator.md`, `leads/generic-lead.md`, `workers/generic-worker.md`: replace `delegate ...` instructions with `@<role>` instructions. Remove all "emit a line for the human to relay" framing — the agents are talking to each other, not to a human relay.
- Update `team-harness-layout.md` §2.6 to match.

**Done when:** vocab and prompts describe the actual chat-room runtime, not human relay.

### Phase 1 — `pi-team` skeleton + `/team-up` boots a single dummy agent (~30 min)
Smallest possible end-to-end vertical slice.

- Scaffold `pi-team/` with `package.json` and TS config (mirror `pi-chains/` conventions).
- `index.ts` registers `/team-up`. Handler reads `.harness/team.yaml`, picks the team shape from `harness/teams/`, but boots **only the orchestrator** (one subprocess) for now.
- Show a minimal full-screen overlay: chat pane (top, fills space), input pane (bottom). No roster, no till-done yet.
- Echo human input to orchestrator subprocess via the subagent-example pattern. Stream orchestrator's output back into chat pane.

**Done when:** in pi-sandbox, `/team-up` boots, you can chat with the orchestrator, output streams in, `Esc` exits.

### Phase 2 — `@mention` routing + multi-agent boot (~45 min)
Bring the full trio up and wire routing.

- Boot all three agents (orchestrator + ui-lead + frontend-worker) per `minimal-trio.yaml`.
- Implement `router.ts`: parse stream for `@<role>` and dispatch the rest of the message to that agent's subprocess. Both directions (down: orch→lead→worker; up: worker→lead→orch).
- Stream every agent's output into the chat pane, color-coded with role label (Dan-style).
- Show the boot tree as a system message at session start (matches screenshot 2).

**Done when:** human sends a multi-step request, orchestrator decomposes and `@ui-lead`s, lead `@frontend-worker`s, worker reports back, orchestrator summarizes to user.

### Phase 3 — Roster pane + cost/token tracking (~30 min)
Add the bottom-left pane.

- `roster.ts` consumes pi's per-subprocess usage data (the subagent example shows how) and updates roster state.
- `RosterPane.ts` renders the tree with costs and token totals.
- Expand chat pane to leave room for roster.

**Done when:** roster updates live as agents spend tokens. Total session cost is visible.

### Phase 4 — Till-done pane + state machine (~30 min)
Add the bottom-right pane.

- `till-done.ts`: parse `done: <id>` from any agent's output, parse `report <to>:` for surface-to-user, parse new till-done items from orchestrator's structured output.
- `TillDonePane.ts` renders `[N/M]` header + items with `✓ ● ○` states.
- Decide on the till-done item-creation protocol: orchestrator either writes them to `runs/<id>/till-done.yaml` (file-based, agent-readable) or emits them inline (`till-done: <id> <description>`). File-based is simpler for week 1; inline is more Dan-faithful.

**Done when:** progress visible live. `[3/8]` increments as items close.

### Phase 5 — `/team-init` bootstrap + `/team-down` (~20 min)
Fill in lifecycle gaps.

- `/team-init`: in a project without `.harness/`, prompt for team shape, scope globs, models. Write `team.yaml`, copy expertise templates.
- `/team-down`: archive the run dir, kill subprocesses, exit overlay.
- `/team-up` in a directory without `.harness/` offers `/team-init` via `ctx.ui.confirm`.

**Done when:** first-time use in pi-sandbox is `/team-up` → "no .harness/, init?" → wizard → team is up.

### Phase 6 — Smoke run on pi-sandbox Challenge 3 (~unbounded)
Real test. No new code unless something breaks.

- `cd ~/work/dev/pi-sandbox && pi`
- `/team-up`
- Paste the Challenge 3 prompt from `team-harness-layout.md` §7.
- Watch.

**Done when:** the team produces a passing implementation, or we have a clear bug list to fix in pi-team. Either is success — Phase 6 is what tells us the harness pattern survives contact.

---

## 6. Decisions baked in (recap)

- **A2 runtime:** session-backed agents, ephemeral pi subprocesses per turn, persistent state via session files. Confirmed by user.
- **Pi extension, not standalone binary.** `/team-up` inside any pi session.
- **TS + ink-style** is unnecessary — pi has its own `@mariozechner/pi-tui` (`ctx.ui.custom`, `Focusable`, `matchesKey`) and the `overlay-test.ts` example shows it handles everything we need (multi-line render, focus, input, themes, IME). Ink is the wrong dependency here.
- **No new chat-room daemon.** Routing is in-process inside the extension.
- **Free models per tier:** `nemotron-3-super` (orchestrator), `minimax-m2.5` (lead), `ling-2.6-flash` (worker). Configurable per project in `team.yaml`.
- **Tear-down done.** `~/work/dev/pi-sandbox/.harness/runs/2026-04-27T...` and the worktree are gone. `team.yaml` and `expertise/` preserved.

---

## 7. Open questions (small, don't block start)

1. **Worker worktree per run** — still want this? With pi-team owning the runtime, we *could* make worktree creation a built-in part of `/team-up` (one worktree per worker, `cwd` set on the spawn). Or keep it manual. Recommend built-in once the routing works (Phase 6+).

2. **Till-done item creation protocol** — file-based (`runs/<id>/till-done.yaml`, orchestrator edits via Edit tool) or inline (`till-done: <id> <desc>` parsed from chat). Recommend file-based for v1 (orchestrator already knows how to use Edit), inline as future polish.

3. **Slash commands inside the harness** — Dan's `/generate <brand> <product> <count> <prompt>` parameterized prompts. Should `pi-team` support per-team slash commands defined in the team config? Recommend deferring to a Phase 7+.

4. **Scope-violation logging** — currently planned as `git diff` after the fact. With pi-team owning the worker subprocess, we could intercept the worker's `Edit` tool calls and log/block out-of-scope writes inline. Recommend deferring; honour-system + post-hoc diff is fine for v1.

5. **Dan's skill/expertise/domain primitives** (from his `vue-generator.md` screenshots, 2026-04-27). Three concepts to evaluate later:
   - **`skills:` per-agent** — pi-skills referenced from each agent's frontmatter. Worth adding `pi-roles/active-listener/` ("read conversation log every turn") and `pi-roles/precise-worker/` ("execute exactly what your lead assigned, no improvising"). Currently inlined in `roster-prompt.ts`; extracting as skills makes them reusable and keeps the prompt thin.
   - **`expertise:` files** — long-lived per-agent scratchpad YAMLs (`updatable: true`, `max-lines: 10000`) the agent reads at task start and writes back. Persistent agent memory across turns. Defer until there's a concrete use case.
   - **`domain:` paths** — explicit per-agent filesystem ACL with `read/upsert/delete` per path. Real win we're missing: workers currently get unrestricted `read,edit,bash`. Consider a `scopes:` allowlist enforced at subprocess spawn (cwd + tool restriction). Defer to a Phase 7+.

---

## 8. What to do first when you say go

1. Phase 0 (vocab + prompt fixes). 10 minutes. Verifiable by reading `harness/vocabulary.md`.
2. Then Phase 1 (skeleton + single-agent boot). 30 minutes. Verifiable by `/team-up` showing an overlay you can chat in.
3. Pause for review. We look at what Phase 1 produced and decide whether Phase 2 onwards needs adjustment before continuing.

If you want me to do Phase 0 + 1 now and pause, say go. If you want to react to anything in this plan first, react now.

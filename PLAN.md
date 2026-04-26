# pi-toolkit — Implementation Plan

**Status:** Planning. Fresh start in new repo.
**Author context:** Drafted with Sebastian on 2026-04-26 in pi-sandbox session, after exploring pi-mono ecosystem and disler/pi-vs-claude-code patterns. This file is the handoff to a fresh agent in this repo.

---

## What this is

A toolkit for working productively with **pi** (badlogic/pi-mono coding-agent). Pi is intentionally minimal — no plan mode, no subagents, no permissions, no MCP, no todos. This repo provides reusable primitives so Sebastian doesn't reinvent the wheel for every workflow.

Two layers:

1. **`pi-roles/`** — library of role skills (scout, builder, verifier, etc.). Markdown only. Referenced via symlink into pi's skill discovery paths. No "install" needed for these.
2. **`pi-chains/`** — pi extension that reads YAML chain definitions and spawns roles in sequence via `child_process.spawn("pi", [...])`. This one IS installed into pi (TS extension with deps).

A third optional layer — workflow consumers like takt — live in their own repos and reference pi-toolkit's roles/chains. Out of scope for this plan; mentioned for context.

---

## Why this exists (decision history from the planning session)

Several decisions shaped this design. Preserved here so the implementing agent doesn't relitigate:

1. **Pi is bare by design.** Sebastian commits to running pi otherwise minimal — no community skills/extensions installed except `pi-mcp-adapter` (bridges MCP servers to pi). Add deps only when pain is felt.
2. **Don't port takt 1:1 to pi.** Original plan was "takt-pi pack." Abandoned in favor of role library + chain runner because:
   - Roles are reusable across many workflows (audit, refactor, ad-hoc investigation), not just takt
   - Specialization beats generalization at small-model scale (MiniMax m2.5 will perform better as narrow specialist)
   - Mirrors disler's working pattern (pi-vs-claude-code repo)
3. **Reference, don't install, for markdown.** Pi auto-discovers skills from multiple paths. Symlink `pi-roles/*` into `~/.pi/agent/skills/` instead of copying. Edit in repo, pi sees changes immediately, versioned in git.
4. **Raw `child_process.spawn`, not `pi-subagents` npm.** disler's repo (868 stars, active) ships 16 extensions on raw spawn. Validates the primitive. Keeps deps minimal, code owned, debuggable. ~50 LOC for the spawner.
5. **Roles named generically.** `worker` not `takt-worker`. Roles outlive any single workflow.
6. **No model locking.** Per-role model override is supported but **defaults to pi's currently active model** (no role pins a model). Sebastian swaps models freely at the pi level; chains follow. Later, when OpenAI sub lands, per-role pinning becomes opt-in (worker = mini, reviewer = full) without architecture changes.
7. **No `max_tokens` config.** Parity with current takt — same knobs, no new surface area.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│ Layer 3: Workflow consumers (separate repos)         │
│   takt, audit, refactor, ad-hoc chains, etc.         │
│   Each = chain YAML + optional state wrapper         │
└──────────────────────────────────────────────────────┘
                       ↑ references
┌──────────────────────────────────────────────────────┐
│ Layer 2: pi-chains (extension + chain runner)        │
│   - Reads chains.yaml                                │
│   - Spawns roles via child_process.spawn("pi", ...)  │
│   - Pipes output: $INPUT, $ORIGINAL                  │
│   - Per-step model + tool overrides                  │
│   - Exposes /chain-run, /chain-list, /chain-resume   │
└──────────────────────────────────────────────────────┘
                       ↑ uses
┌──────────────────────────────────────────────────────┐
│ Layer 1: pi-roles (skill library)                    │
│   - One SKILL.md per role                            │
│   - Tool restrictions in frontmatter                 │
│   - Persona + behavioral rules in body               │
│   - Reusable standalone (/skill:scout) or in chains  │
│   - Symlinked into ~/.pi/agent/skills/, not copied   │
└──────────────────────────────────────────────────────┘
```

---

## Repo layout

```
pi-toolkit/                          # ~/work/git/pi-toolkit
├── README.md
├── PLAN.md                          # this file
├── install.sh                       # symlinks roles, builds + installs pi-chains
├── pi-roles/                        # Layer 1 — markdown skills, no build
│   ├── README.md
│   ├── scout/SKILL.md
│   ├── architect/SKILL.md
│   ├── builder/SKILL.md
│   ├── verifier/SKILL.md
│   ├── reviewer/SKILL.md
│   └── debugger/SKILL.md
├── pi-chains/                       # Layer 2 — TS extension
│   ├── README.md
│   ├── package.json
│   ├── pi.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── extension.ts             # registers /chain-run, /chain-list, /chain-resume
│   │   ├── runner.ts                # phase loop + variable substitution
│   │   ├── spawner.ts               # child_process.spawn("pi", [...])
│   │   ├── chains-loader.ts         # reads YAML from chains_dir
│   │   └── role-resolver.ts         # resolves role -> skill name + model defaults
│   ├── examples/                    # default chains shipped with the extension
│   │   ├── plan-build-review.yaml
│   │   ├── scout-flow.yaml          # disler-style triple recon
│   │   ├── audit.yaml
│   │   ├── debug-fix.yaml
│   │   └── refactor.yaml
│   └── tests/
└── docs/
    ├── roles-library.md             # Phase 0 deliverable — role inventory
    ├── chain-format.md              # YAML chain schema
    └── design-notes.md              # decisions + reasoning archive
```

---

## Phase 0 — Role inventory (FIRST DELIVERABLE, before any code)

Write `docs/roles-library.md` defining each v1 role precisely. For each:

- **Name**
- **One-line purpose**
- **Tools** (subset of read, write, edit, bash, grep, find, ls)
- **Inputs** (what it expects in the prompt — task, prior step output, files to focus on)
- **Outputs** (what it produces — file edits, structured findings, verdict, bug ticket)
- **Behavioral rules** (what it WILL NOT do — e.g., builder won't run tests, verifier won't edit code)
- **Failure modes to watch for** during benchmarking
- **Suggested model tier** (informational only — not enforced. Default = inherit pi's active model. Tier note guides future per-role pinning: worker-grade vs critic-grade vs architect-grade)

**Starting role list (v1):**

| Role | Tools | Purpose |
|---|---|---|
| `scout` | read, grep, find, ls | Read-only recon. Maps relevant code, identifies files, surfaces patterns. Output = structured findings document. |
| `architect` | read, grep, find, ls | Designs implementation approach given task + scout findings. Output = approach doc proposing file-level changes. |
| `builder` | read, write, edit, grep, find, ls | Implements approach. Edits files. NO bash (verifier runs tests). Output = file edits + brief implementation notes. |
| `verifier` | read, bash, grep, find, ls | Runs tests, verifies scenarios. Output = pass/fail verdict + bug ticket if fail. NO edits. |
| `reviewer` | read, grep, find, ls | Final judgment. Reviews diff against original task. Output = approve/reject + reasoning. NO edits, NO bash. |
| `debugger` | read, bash, grep, find, ls | Investigates failures. Reads logs, runs diagnostics. Output = root-cause writeup + suggested fix. NO edits. |

**Open questions during inventory:**
- Is `architect` distinct enough from `scout`+`builder`? Or do scout findings + builder judgment cover it?
- Do we need `senior` (complex implementation w/ judgment) separate from `builder`, or is that just a model upgrade on builder?
- Skip `red-team`, `documenter`, `refactorer`, `planner` for v1 — add only when needed.

**Phase 0 deliverable:** `docs/roles-library.md` complete, signed off by Sebastian, before any SKILL.md files are written.

---

## Phase 1 — Skill files (`pi-roles/`)

Each role becomes one SKILL.md. Reference format (verify against pi docs):

```markdown
---
name: scout
description: Read-only codebase reconnaissance
tools: read, grep, find, ls
---

# Scout

You are a Scout. Map relevant code for a given task...

## Rules
- NEVER write or edit files
- Output findings as structured Markdown
- Cite file:line for every claim
```

**Reference existing pi skills on this machine** to confirm format:
- `~/.pi/agent/skills/integration-verifier/SKILL.md`
- `~/.pi/agent/skills/test-architect/SKILL.md`

**Deliverable:** six SKILL.md files in `pi-roles/`. Each invokable standalone via `/skill:scout` etc. in pi after symlinking.

---

## Phase 2 — Chain runner (`pi-chains/`)

Pi extension that reads YAML chains and spawns roles sequentially.

**Chain YAML format** (modeled on disler's `agent-chain.yaml`):

```yaml
name: plan-build-review
description: Standard implementation chain
steps:
  - role: scout
    prompt: "$ORIGINAL"
  - role: architect
    prompt: "Original task: $ORIGINAL\n\nScout findings:\n$INPUT"
  - role: builder
    prompt: "Approach:\n$INPUT\n\nOriginal: $ORIGINAL"
  - role: verifier
    prompt: "Implementation done. Verify:\n$INPUT"
  - role: reviewer
    prompt: "Verifier output:\n$INPUT\n\nOriginal task: $ORIGINAL"
```

**Variables:**
- `$ORIGINAL` — original task prompt passed to /chain-run
- `$INPUT` — previous step's final output
- `$STEP[N]` — output of step N (for non-linear flows)

**Per-step overrides (optional):**
```yaml
- role: builder
  model: minimax-m2.5
  provider: opencode-zen
  prompt: "..."
```

If `model`/`provider` omitted, the spawner does **not** pass `--model` and pi uses its currently active model. Optional `~/.pi-chains/config.json` or per-project `.pi-chains/config.json` can set per-role pins later, but default = inherit active.

**Spawning:** raw `child_process.spawn("pi", ["-p", "--mode", "json", "--model", X, "/skill:<role>\n\n<prompt>"])`. Pattern validated by disler's `extensions/agent-chain.ts:30`.

**Extension surface:**
- `/chain-run <name> "<prompt>"` — execute a chain
- `/chain-list` — list available chains
- `/chain-resume <session-id>` — resume crashed chain (uses pi's `--session` JSONL)

**Chain discovery:** reads from (in order):
1. `pi-chains/examples/` (built-in defaults shipped with extension)
2. `~/.pi-chains/chains/` (user global)
3. `.pi-chains/chains/` (project local)

**Deliverable:** `/chain-run plan-build-review "implement Categories CRUD"` runs end-to-end against pi-sandbox.

---

## Phase 3 — Default chains library (`pi-chains/examples/`)

Ship five starter chains:

| Chain | Steps | Use case |
|---|---|---|
| `plan-build-review` | scout → architect → builder → verifier → reviewer | Standard implementation |
| `scout-flow` | scout × 3 | Triple recon (disler's plan-mode substitute) |
| `audit` | scout → reviewer | Read-only assessment, no changes |
| `debug-fix` | debugger → builder → verifier | Bug triage + fix |
| `refactor` | scout → architect → builder × N → verifier | Iterative restructuring |

These are starting points. Users author their own in `.pi-chains/chains/`.

---

## Phase 4 — Spike + benchmark — ✅ PASSED (2026-04-26)

Ran `plan-build-review` against pi-sandbox Challenge 1 with MiniMax m2.5 across all roles. Bypassed the pi TUI by calling `runChain()` directly from `pi-chains/tests/spike.mjs` against a tmp clone of pi-sandbox.

**Result:** 26/27 tests pass after the chain. The one failure (`should return empty results for non-existent status`) is a **pre-existing buggy test** in the suite, documented in `pi-sandbox/BENCHMARKS.md` Challenge 3: "One self-contradicting test: sends `?status=nonexistent` but expects 200 — validation correctly returns 400." Not a chain regression.

**Per-step timing (first run, m2.5):**
- scout: 41s
- architect: 37s
- builder: 26s
- verifier: 1223s ← jest hang (now bounded by per-step timeout, see fix below)
- reviewer: 2s

**Bugs found by the spike (fixed):**
1. `spawner.ts` didn't pass `cwd` to `child_process.spawn` — pi ran in the parent's cwd instead of the chain workdir, so all steps looked at the wrong tree. Commit `28844bb`.
2. `verifier`'s `npm test` triggered the same jest hang seen in `BENCHMARKS.md` Challenge 1. Pi waits indefinitely for the tool call to return. Mitigated by per-step `timeout_sec` in chain YAML (default 10 min, set to 240s on every implementation chain's verifier step). Commit `caf8eb5`.

**Go/no-go: GO.** MiniMax m2.5 carries the role-specialized chain end-to-end on a non-trivial refactor task. Stronger models (OpenAI in ~2 weeks) only widen the margin.

---

## install.sh

Two jobs:

1. **Symlink role skills** into `~/.pi/agent/skills/`:
   ```bash
   for role in pi-roles/*/; do
     ln -sfn "$(pwd)/$role" "$HOME/.pi/agent/skills/$(basename $role)"
   done
   ```
2. **Build + install pi-chains extension:**
   ```bash
   cd pi-chains
   npm install
   npm run build
   pi install file:$(pwd)
   ```

Detect if pi is installed first; warn and exit if not. (Optional: detect Claude Code too, but Sebastian is shifting away — no Claude install path needed in this repo.)

---

## Pi baseline deps (install before this work)

1. **pi-mcp-adapter** (nicobailon, npm) — bridges MCP servers (jCodeMunch, context-mode, munin, obsidian). `pi install npm:pi-mcp-adapter` (verify exact pkg name).

That's it. Nothing else.

---

## Build order

| Step | Phase | Deliverable | Validation |
|---|---|---|---|
| 0 | 0 | Read pi docs (`docs/skills.md`, `docs/sdk.md`, `docs/json.md`, `docs/models.md`, `docs/custom-provider.md`) + existing pi skills on this machine. Resolve open questions in this plan. | Open questions section updated with answers |
| 1 | 0 | `docs/roles-library.md` | Sebastian sign-off |
| 2 | 1 | Six SKILL.md files in `pi-roles/` | Each callable standalone via `/skill:<name>` after symlink |
| 3 | 2 | `pi-chains` extension skeleton: package.json, pi.json, extension.ts registering `/chain-list` only | `pi install file:./pi-chains` succeeds, `/chain-list` works |
| 4 | 2 | `chains-loader.ts` + `spawner.ts` + `runner.ts` (sequential, single role) | `/chain-run audit "scan src/"` runs single-step chain |
| 5 | 2 | Variable substitution ($INPUT, $ORIGINAL), multi-step chains, per-step model overrides | Multi-step chain pipes output correctly |
| 6 | 3 | Five default chain YAMLs | All chains load + execute |
| 7 | 4 | **Spike on pi-sandbox Challenge 1** with `plan-build-review` chain | Compare vs Phase 1 benchmarks. Go/no-go. |
| 8 | — | `install.sh` finalized + README | Fresh clone + `./install.sh` works |

---

## Key open questions — resolved (step 0, 2026-04-26)

1. **Skill frontmatter.** Required: `name` (lowercase a-z 0-9 hyphens, max 64, must match parent dir), `description` (max 1024). Optional: `license`, `compatibility`, `metadata`, `allowed-tools` (space-delimited, **experimental — pi only warns, does not enforce**), `disable-model-invocation`. Unknown fields ignored. Source: `pi-mono/packages/coding-agent/docs/skills.md`.
2. **`-p` + `--mode json` + `--model` + `--skill`.** All compose. CLI flags confirmed via `pi --help`: `-p`/`--print`, `--mode <text|json|rpc>`, `--model <pattern>`, `--skill <path>` (repeatable, additive even with `--no-skills`), `--tools <comma-list>`, `--append-system-prompt`, `--session <path|id>`, `-c`/`--continue`. disler's `agent-chain.ts` validates the spawn pattern (uses all of these together).
3. **opencode-zen.** Not built-in. Needs a custom-provider extension (see `docs/custom-provider.md`). Out of scope for pi-chains itself — Sebastian configures it in pi globally; chains inherit.
4. **`pi install file:`.** `pi install <source>` accepts paths/URLs. Use `pi install <abs-path>` or `pi install file:<abs-path>` from install.sh. Verify exact prefix when implementing — `pi install --help` is authoritative.
5. **Tool restriction enforcement.** `allowed-tools` in skill frontmatter is **experimental and lenient**. The hard enforcement path is the **`--tools <list>` CLI flag at spawn time**. ⇒ pi-chains spawner MUST pass `--tools` per role from the role's frontmatter (read at chain-load time). Skill `allowed-tools` becomes the source-of-truth list; spawner converts to comma-separated `--tools` arg.
6. **Architect role.** Keep separate in v1. scout = read-only mapping, architect = approach/design doc, builder = edits. Architect's reasoning load justifies a distinct prompt + future model pin. Cheap to merge later if benchmarks show overlap.
7. **Symlinks.** Pi discovery is plain filesystem traversal — symlinks resolve transparently. install.sh symlinking `pi-roles/*` into `~/.pi/agent/skills/` is supported. Confirmed indirectly via discovery rules in `docs/skills.md` (no symlink restriction).

### Spawn pattern (locked in for Phase 2)

Per disler `extensions/agent-chain.ts:runAgent`:
```
pi --mode json -p \
   --no-extensions \
   [--model <provider/id>]   # omit to inherit pi's active model
   --tools <csv from skill allowed-tools> \
   --thinking off \
   --skill <abs path to role SKILL.md> \
   --session <chain-session-file> \
   [-c if resuming] \
   "<rendered prompt>"
```
Use `--skill` (file path) instead of relying on global discovery — chains run with `--no-extensions` and explicit skill load for hermetic behavior. Prompt body invokes the role implicitly (skill content is loaded; prompt = task + piped `$INPUT`/`$ORIGINAL`).

---

## Risks

1. **MiniMax m2.5 may fail at multi-role chains.** Pi-sandbox Phase 1 benchmarks suggest reasoning is the weak spot. Architect + reviewer roles are reasoning-heavy. Spike (step 7) is the existential test for free-tier viability.
2. **Chain overhead.** Each step = fresh pi process + cold model load. 5-step chain × 10 stories = 50 cold spawns. Painful interactively, fine headless. Budget estimate during spike.
3. **Pi spec drift.** disler's spawn pattern works as of 2026-04-11. Pi could change CLI flags. Mitigation: pin pi version in install.sh, document it.
4. **Free tier rate limits.** Sequential chains avoid parallel 429s. Add retry-on-429 in spawner.
5. **Role bleed.** If skill persona instructions don't enforce tool restrictions hard enough, builder might run tests, verifier might try to edit. Pi's frontmatter `tools:` enforcement is the safety net (open question #5).

---

## Reference material

**Pi docs (read first in step 0):**
- https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent
- `docs/skills.md`, `docs/sdk.md`, `docs/json.md`, `docs/models.md`, `docs/custom-provider.md`

**disler/pi-vs-claude-code (pattern source — clone-and-copy reference):**
- https://github.com/disler/pi-vs-claude-code
- `extensions/agent-chain.ts` — raw spawn pattern, 30+ LOC
- `extensions/subagent-widget.ts` — session-file resume pattern
- `.pi/agents/*.md` — role file format reference
- `agent-chain.yaml`, `teams.yaml` — chain YAML format reference

**Awesome list:**
- https://github.com/qualisero/awesome-pi-agent — community pkg index

**Existing pi assets on this machine:**
- `~/.pi/agent/skills/integration-verifier/SKILL.md`, `test-architect/SKILL.md` — reference skill format
- `~/.pi/agent/models.json` — current pi model config
- `~/work/dev/pi-sandbox/.pi/AGENTS.md` — reference AGENTS.md
- `~/work/dev/pi-sandbox/BENCHMARKS.md` — Phase 1 baselines for spike comparison

**Related repos (out of scope here):**
- `~/work/git/takt/` — current Claude Code takt. Will eventually become a chain consumer of pi-toolkit (separate repo, not migrated yet). Ignore for this plan.

---

## First task for implementing agent

**Step 0:**
1. Read pi docs (5 files listed above)
2. Read existing pi skills (`~/.pi/agent/skills/integration-verifier/`, `test-architect/`)
3. Read disler's `extensions/agent-chain.ts` to confirm spawn pattern still works
4. Update "Key open questions" section in this plan with answers
5. Then draft `docs/roles-library.md` for the six v1 roles per Phase 0 spec

**Do NOT skip to writing SKILL.md files.** The role inventory IS the design — get the abstractions right before generating any skill content.

Ask Sebastian to review `docs/roles-library.md` before proceeding to Phase 1.

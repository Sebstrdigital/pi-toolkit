# Multi-Team Agent Harness — The Generic Concept

**Source:** IndyDevDan, *"My Pi Agent Teams. Claude Code Leak SIGNAL. Harness Engineering"*
**URL:** https://www.youtube.com/watch?v=RairMJflUSA
**Underlying tool:** the **pi coding agent** (the same harness layer pi-toolkit extends).

This document extracts the *generic, domain-agnostic* harness pattern from Dan's video. Dan demonstrates the pattern on a UI-generation product he calls "Infinite UI", but that's just one application. The pattern itself is independent of the domain.

---

## 1. Why the harness matters at all

The Claude Code source-code leak is Dan's framing device. His takeaway: the **agent harness is the product**, not the model. Models commoditize quickly. The harness — the layer that owns context, orchestration, prompts, skills, tools, caching, and deterministic glue code — is the durable surface where leverage accumulates.

The actionable consequence: **harness engineering** is a high-leverage skill. Using a stock harness means competing on identical ground with everyone else. Customizing or building your own harness lets you specialize for a problem class and capture a sliver of the same value the harness vendors capture.

This concept document is about the *shape* of such a customized harness — the team pattern Dan has converged on after iterating across his "CEO agents", "Lead agents", and now "UI agents" assets. The team structure is the same in all three; only the domain on top differs.

---

## 2. The architecture: three tiers, N teams

```
                [ user chat ]
                      │
                ┌─────▼──────┐
                │Orchestrator│       (exactly one)
                └──┬──┬──┬───┘
           ┌──────┘  │  └──────┐
         Lead A    Lead B    Lead C   (N parallel teams)
           │         │         │
        workers   workers   workers   (M specialists per team)
```

**Orchestrator (one):** the only agent the human talks to. It thinks, plans, prompts, and delegates — it never produces final artifacts itself. The orchestrator has been *taught how to prompt-engineer*, so when it dispatches work to leads it sends fully-formed, well-structured prompts rather than thin instructions.

**Leads (one per team):** plan and decompose. They turn an orchestrator assignment into worker tasks, validate worker output, and report back. Strict rule: leads do not produce artifacts.

**Workers (many per team):** hyper-specialized. The principle is *one agent, one prompt, one purpose*. Each worker has a narrow context window and a narrow remit — scaffolder, generator, validator, analyst, specialist of some kind.

**Why this shape:** the user's input bandwidth stays O(1) (one chat to one orchestrator) while compute scales O(N×M) across teams and workers. Leads absorb coordination cost so workers stay focused. Without this separation, a system with twenty agents would force the human to coordinate twenty agents.

The tier discipline (orchestrators and leads don't write; only workers write) is what keeps the system coherent at scale. It's also what makes graceful degradation possible — see §4.

---

## 3. The generic mechanics

These are the building blocks. None of them are domain-specific.

### Per-team model assignment
Each team is pinned to a different model. Same role, same prompts — different model. This gives you live A/B comparison and, more importantly, **failure isolation**. When one model hangs, the orchestrator routes to a working team. Because you own the harness, adding a model-rotation/fallback policy is trivial.

### Per-agent expertise files (self-curating mental models)
Each agent owns its own ~7K-token expertise file *that the agent writes itself* and updates as it works. It records work history, decisions, open questions, and patterns. The human never edits these files. Each agent has exactly one skill — a short, non-prescriptive instruction on *how to maintain its mental model* — and is otherwise free to structure the file however it wants. Across sessions, agents accumulate real domain expertise.

### Front-matter as the customization surface
Each agent definition exposes rich front-matter:
- **model** — which LLM the agent runs on
- **expertise file** — hot-loaded into the system prompt
- **tools** — scoped per agent
- **domain** — a path glob restricting where the agent can read/write

The domain restriction is unsung. Scoping an agent's filesystem reach to a single area produces a focused context window and prevents cross-domain confusion in mid-to-large codebases.

### Till-done lists (not to-do lists)
Tasks have explicit completion criteria. Agents loop until everything is actually done rather than checking off and exiting. This is what enables recovery when workers fail: the task remains open, and someone (a retrying worker, or a lead breaking rank) eventually closes it.

### Information-dense keywords
A small shared vocabulary acts as quasi-tools. `delegate` is the canonical example. Workflows are written using these tokens, which keeps prompts short while being unambiguous. It's a convention, not a programming language — but every agent in the system understands it.

### Reusable parameterized prompts
Workflows live as reusable commands with named parameters and a fixed structure (variables → instructions → workflow). They always address the orchestrator, because that is the only valid entry point. They are valid only inside this harness — they assume the team structure exists.

### "Build the system that builds the system"
The meta-pattern Dan returns to throughout. You don't build the application directly. You build the *team of agents* that builds and operates the application. The upfront investment is justified because once the team exists, every subsequent feature is a chat message.

---

## 4. Failure modes the pattern handles natively

The team structure isn't only a throughput pattern — it's a fault-tolerance pattern.

- **Worker stall:** the lead detects no progress and either retries, reassigns, or (in the live demo) breaks the no-write rule and produces the output itself. Graceful degradation by role-violation.
- **Whole-team failure:** the orchestrator routes remaining work to a healthy team. Multi-team membership turns a stall into a routing decision rather than a dead end.
- **Validation failure:** validators are themselves workers, so a failed validation is just another open till-done item that triggers another delegation cycle.

A single-agent system has none of these recovery paths.

---

## 5. What Dan added on top (for clarity, not to copy)

To separate concept from application: Dan glued this generic harness to a domain he calls **Infinite UI** — a product that generates branded UI variants in a `workspace → brand → product → tree → variant` hierarchy. That hierarchy is *his* domain model, not part of the harness pattern. The team structure, expertise files, till-done loops, and front-matter customization are independent of it and would work identically over any other domain.

His earlier assets in the same series — "CEO agents" and "Lead agents" — reuse the same harness pattern over different domains. The harness is the reusable part.

---

## 6. Mapping to pi-toolkit

pi-toolkit already lives in the harness-customization layer (recent commits: `pi-mcp-adapter` with three MCP servers, `pi-ui` extension with a three-zone footer). The interesting question is which generic pieces of Dan's pattern we want to adopt — independent of any specific application domain.

| Generic pattern | Fit | Notes |
|---|---|---|
| 3-tier orchestrator/lead/worker structure | High | Needs a team-composition file and the wiring to spawn tiers. |
| Per-agent front-matter (model, domain, expertise, tools) | High | Domain scoping is especially valuable given the multi-repo `~/work/git/` workspace. |
| Self-curating expertise files | Medium | Cheap to add: a storage convention plus one "maintain your mental model" skill. |
| Till-done list semantics | Medium | Replaces the typical to-do-then-exit loop. |
| Per-team model rotation / fallback | High | Pairs naturally with `pi-mcp-adapter`. Turns model failures into routing decisions. |
| Information-dense keyword vocabulary | Medium | Pure convention. Worth defining early so all agents speak it. |
| Reusable parameterized prompts | High | Skills are the seed; this is the next step toward parameterized workflows. |
| Single-chat orchestrator ingress | High | Architectural — affects what `pi-ui` is. |
| A/B teams for model comparison | Low priority | Worth doing once the base team structure exists. |

### Open questions, scoped to the *concept*

1. **Team composition surface.** What does our equivalent of Dan's `multi-team.yaml` look like? How are teams declared, and how is the tier discipline enforced?
2. **Expertise-file storage.** Per-project, per-agent globally, or both? There's a real tension between project-scoped knowledge (this codebase) and agent-scoped knowledge (this specialist's general approach).
3. **Orchestrator ingress.** Does `pi-ui` grow into the chat surface, or stays observability-only and we add a separate ingress?
4. **Model abstraction.** Does `pi-mcp-adapter` become the model-rotation layer, giving us per-team model swap and fallback for free?

The "what domain do we run this on" question is downstream of these. The harness pattern exists independent of any domain — we can build it first and choose what to point it at later.

---

## 7. TL;DR

The generic concept is:

- A **single chat ingress** to a **single orchestrator**.
- The orchestrator delegates to **leads**, who delegate to **specialist workers**.
- Tiers are disciplined: only workers produce artifacts.
- Each agent is customized via **front-matter** (model, domain glob, expertise file, tools).
- Each agent maintains its own **self-curating expertise file**.
- Tasks run on **till-done semantics** and are coordinated through a small vocabulary of **information-dense keywords**.
- Multiple teams can run in parallel with **different models per team**, giving A/B comparison and fault tolerance for free.
- The whole pattern is the substrate for the meta-move: **building the system that builds the system**.

That is the generic harness team. Everything else — Infinite UI, CEO agents, Lead agents — is a domain Dan happened to point it at. We can adopt the pattern first and decide what we point it at separately.

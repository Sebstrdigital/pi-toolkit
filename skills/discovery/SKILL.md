---
name: discovery
description: Clarify customer purpose and reach a decision from existing context and proportionate experiments. Use for consequential uncertainty before recommending Direct, Developer or Team, not for every small fix.
---

# Discovery and decisions

Be the user's thinking partner. Synthesize the conversation and inspected evidence, not a new questionnaire. Discovery is optional: a small understood request can proceed to an execution recommendation immediately. Read applicable project rules and recall relevant decisions under the git-root project name. Separate known facts, assumptions and consequential unknowns; trace claims to inspected paths or observed results.

## Establish the decision

State the customer outcome, why it matters, constraints, exclusions and the decision to be made. Distinguish observable customer acceptance from engineering tasks. Inspect available context before asking one consequential question at a time. Do not ask again for decisions already supplied. Compare viable options and explain the chosen direction and important trade-offs.

For example, a native-TTS investigation needs a matched Python/native comparator early enough to choose whether native work is worthwhile. A polished native-only benchmark is not comparative decision evidence. This example guides sequencing, not permission to touch a real application or run audio.

## Use the smallest sufficient experiment

Propose a bounded experiment only if it could change the decision. Before execution, specify the question, comparator/conditions, sufficient-evidence criteria, exact checks, allowed files/resources, effort or time budget and stopping rule. Obtain applicable approval; discovery itself does not authorize edits, installation, outward actions or destructive cleanup. Do not weaken project validation rules without explicit approval.

When a substantial blocker appears, check whether the blocked step is necessary to answer the question, whether a cheaper safe alternative supplies sufficient evidence, and whether stopping is more useful than repairing infrastructure. A failed or inconclusive experiment is a valid result. Report uncertainty honestly; do not perfect tooling merely because work has started. Park unrelated improvements with reasons rather than expanding scope.

## Recommend, then let the user choose

When purpose and direction are sufficiently understood, recommend one path with a brief reason:

- **Direct:** current-agent implementation for small, understood, localized work. No mandatory files; a concise proposal and explicit approval can suffice.
- **Developer:** one bounded builder when separate context is useful. Normally one compact approved packet preserving purpose, scope, rules, checks and acceptance, followed by parent inspection. It requires the explicit narrow invocation `developer` from the opt-in tmux adapter; read `../../docs/lean-workflows.md` (Standalone Developer invocation) for the exact packet/reference fields and prerequisites. Existing Team launch controls are not standalone Developer authority. If unavailable, explain the limitation and offer Direct or explicitly selected Team instead, never bypass those controls.
- **Team:** consequential work with dependencies or substantial validation/review. User selection authorizes preparation only. Read the delivery skill (the supported internal compatibility name), synthesize Brief/Plan/Agreement and wait for approval of the actual Agreement before launching.

If important uncertainty remains, recommend further discovery or an approved experiment instead of a builder. Do not automatically select Team. A long or interrupted investigation may save a draft Brief early; label it unapproved and avoid inventing execution authority. Use the delivery skill's `references/templates/brief.md` when a durable draft helps, not a separate document skill or planning agent.

## Communicate and preserve

Narrate meaningful findings, decisions, blockers and completion, not every tool call. Keep detailed evidence inspectable. Save decision-relevant findings and parked work in the agreed record; lead-owned Munin summaries omit secrets. Observed demonstrations and static instruction tests are not universal guarantees of model behavior or customer satisfaction.

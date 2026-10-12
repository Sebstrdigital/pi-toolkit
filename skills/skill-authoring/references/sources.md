# Sources and adaptation notes

This skill adapts selected authoring patterns, not entire upstream packages.
The following revisions identify the reviewed upstream material; the local
adaptation is maintained independently. Applicable MIT notices are retained in
`../LICENSE` relative to this reference file, or `LICENSE` from the skill root.

## Cory Hall: toolkit / skill-authoring

Revision: `91f65941d72a207bcb52381f5dd9fbff2a09f36e`.

- [Skill instructions](https://github.com/corymhall/toolkit/blob/91f65941d72a207bcb52381f5dd9fbff2a09f36e/skills/ai-harness/skill-authoring/SKILL.md)
- [Prompting lens](https://github.com/corymhall/toolkit/blob/91f65941d72a207bcb52381f5dd9fbff2a09f36e/skills/ai-harness/skill-authoring/references/skill-prompting-lens.md)
- [MIT license](https://github.com/corymhall/toolkit/blob/91f65941d72a207bcb52381f5dd9fbff2a09f36e/LICENSE)

Adapted evidence-backed intervention design, preservation during revision,
read-only review, and skepticism about unsupported prompt weight. Replaced the
manual-only invocation default with a narrow automatic routing description.
Kept the proposal conversational rather than requiring a durable change contract.
Did not import the separate harness-evaluation workflow.

## Firstpick: Pi coding agent forge / vendored skill creator

Revision: `d4fecf366c8df75fabd7260a81b1bf44f8676061`.

- [Creator instructions](https://github.com/Firstp1ck/pi-coding-agent-forge/blob/d4fecf366c8df75fabd7260a81b1bf44f8676061/pi-package-skill-lifecycle/vendor/pi-skill-skill-creator/skills/skill-creator/SKILL.md)
- [Quality guide](https://github.com/Firstp1ck/pi-coding-agent-forge/blob/d4fecf366c8df75fabd7260a81b1bf44f8676061/pi-package-skill-lifecycle/vendor/pi-skill-skill-creator/skills/skill-creator/references/SKILL-QUALITY-GUIDE.md)
- [Component MIT license](https://github.com/Firstp1ck/pi-coding-agent-forge/blob/d4fecf366c8df75fabd7260a81b1bf44f8676061/pi-package-skill-lifecycle/vendor/pi-skill-skill-creator/LICENSE)

Adapted deliberate invocation design, pruning stale or duplicated instructions,
observable completion, and keeping unapproved drafts outside discovered roots.
Did not import its extension, generator, evaluator, fixed section template,
three-success threshold, or vendored writing-great-skills material.

## Sébastien Servouze: pi-agents / agent-skill-creator

Revision: `eeaa7af0eb877d01fd7b72a65ba85dac7a0d261c`.

- [Agent instructions](https://github.com/sebastienservouze/pi-agents/blob/eeaa7af0eb877d01fd7b72a65ba85dac7a0d261c/agents/AGENT-SKILL-CREATOR.md)
- [MIT license](https://github.com/sebastienservouze/pi-agents/blob/eeaa7af0eb877d01fd7b72a65ba85dac7a0d261c/LICENSE)

Adapted the reuse/adapt/create comparison and inspection of dependencies,
permissions, security, licensing, and portability before adoption. Did not import
its agent mode, tool allowlist, specialized save/validation tools, or draft paths
inside skill roots. The local skill uses only capabilities actually available in
the active session and its existing approval rules.

## Reviewed but not incorporated

[S1M0N38/pi-skill-creator](https://github.com/S1M0N38/pi-skill-creator) was reviewed
for evaluation and iteration ideas. No source text or code was incorporated:
its README/package declare MIT while its `LICENSE.txt` contains Apache-2.0.
Its inline with/without-skill procedure also cannot provide a clean baseline
after the skill has already been read. This adaptation uses ordinary lightweight
checks and requires fresh contexts for meaningful behavioral comparisons.

## Pi conventions

Technical loading and configuration guidance was checked against the installed
Pi 1.1.0 documentation. The [Agent Skills specification](https://agentskills.io/specification)
provides the portable format; Pi's current bundled documentation remains the
source for Pi-specific behavior. See `pi-conventions.md` in this directory for
the documentation topics and version caveat.

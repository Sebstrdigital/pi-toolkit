# Skill quality checklist

Use before finishing creation or revision, or as a read-only review lens. Apply
relevant checks; do not turn every item into a mandatory document or section.

## Purpose and routing

- The skill changes a useful decision or action, rather than restating general
  agent behavior or duplicating stable project documentation.
- The description communicates purpose and concrete triggering contexts.
- Near-misses are excluded. Explicit-only versus automatic invocation is chosen
  deliberately; broad mentions of a subject do not automatically justify loading.
- Inputs, observable outputs, important stop conditions, and approval boundaries
  are clear enough to follow without inventing permissions or requirements.

## Structure and maintenance

- Frontmatter parses; name and description are non-empty and meet length limits.
  The name matches the directory for portability; invocation metadata is boolean.
- Bundled links resolve, referenced resources exist, and script paths are based
  on the skill directory rather than the caller's working directory.
- Each rule has one source of truth. Conditional detail has a clear read trigger.
- Helpers and assets have demonstrated uses; no empty directories, private paths,
  secrets, copied session residue, or speculative infrastructure remain.
- Adapted material has traceable sources and applicable license notices. Conflicts
  are resolved before reuse, not hidden by a new license declaration.
- Revisions preserve useful gates and supporting resources. Added prompt weight
  has a concrete reason; removals do not discard essential domain judgment.

## Verification and claims

- Named commands and tools exist in the intended environment, or an explicit
  fallback explains their absence. External scripts are inspected before use.
- Checks exercise relevant script behavior where applicable, not just filenames.
- Realistic trigger and non-trigger examples have been considered. An observed
  invocation is distinguished from a static walkthrough or loader check.
- Comparisons use separate, fresh contexts and comparable inputs. Costs, access,
  side effects, and evaluation limits are agreed before execution.
- The final report states what was actually checked and what remains untested.
  Saving a file is not installation, and a small eval is not proof of broad value.

## Regression scenarios for this authoring skill

These are walkthrough cases, not evidence of model runs. Reuse them for a bounded
behavioral check when a change affects the corresponding decision:

| Request or situation | Expected behavior |
|---|---|
| “Turn our release-note workflow into a reusable Pi skill.” | Load authoring guidance; inspect context, check reuse, propose location and scope, and wait for approval before edits. |
| “Improve this SKILL.md; it launches tools I don't have.” | Inspect the skill and harness, preserve useful behavior, replace unsupported assumptions within approved scope, and report checks. |
| “Review this imported skill without changing anything.” | Inspect instructions and relevant resources/licensing; return findings only, with no installation or edits. |
| “Use the PDF skill to convert this document.” | Do not load authoring guidance merely because an existing skill is invoked. |
| “What skills are available?” | Do not treat capability discovery as a request to author a skill. |
| A workflow is better expressed as a short prompt or a project rule. | Recommend the simpler resource rather than manufacturing a skill. |
| An imported README and license disagree. | Flag the conflict and avoid copying until resolved. |
| The skill was already read before a proposed “without-skill” run. | Reject that as a clean baseline; use fresh contexts if an evaluation is approved. |
| The repository installer uses a fixed skill list. | Report that the new directory is not registered; do not silently edit the installer. |

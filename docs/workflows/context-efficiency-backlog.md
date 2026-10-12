# Context-efficiency test backlog

## Agreed direction

Start with Pi's native code mode. Keep tasks small, use fresh subagent contexts for bounded work, and keep coordinator handoffs and tool output concise and evidence-linked. Prevent unnecessary context growth rather than relying on conversation compression.

This backlog records evaluation priorities only. It does not authorize installations, configuration changes, worker capability changes, or test execution.

## 1. Native Pi code mode — first priority

**Status:** Enabled for the main agent and new fixed workers under approved Direct implementation. Automated launch/resume tests and native QuickJS/tool-pipeline smoke checks pass; model-choice behavior, latency and cost comparisons remain pending.

Use native `codemode` to process tool results before they enter model context. Start with the coordinator and existing tools; consider workers separately while preserving their fixed role grants and launch/resume restrictions.

Compare direct tool output with code-mode processing of the same representative search results, documents, and validation logs. Check:

- Model-visible output reduction.
- Preservation of failures, skipped checks, relevant exact excerpts, and source/artifact references.
- Output limits, truncation, and processing errors are visible rather than silently treated as complete evidence.
- Latency and cost where observable.
- Independent acceptance remains based on actual changes and evidence, not summaries alone.

## First retrospective — after a few days of normal work

**Decision:** Leave the current “prefer code mode” instructions unchanged until we have normal-task evidence. Context handling, data processing and workflow design are expected to evolve over the next couple of weeks; treat this as an iterative evaluation, not a final architecture.

**Resume cue:** Ask “review our code-mode usage.” Read this backlog and recall the related Munin decisions for `pi-toolkit`. No automatic review or reminder is scheduled.

Review a small representative sample of coordinator and retained worker sessions since code mode was enabled. Exclude synthetic smoke tests and separate sessions before activation or legacy workers without code mode. Record the session references, task type, model, active instructions/tool loadout and relevant workflow changes so later comparisons remain interpretable.

### Questions to answer

1. **Tool selection:** Did agents choose code mode for substantial or uncertain-volume retrieval and bulk processing without user reminders? Which opportunities were missed? Invocation counts alone are not success.
2. **Context admission:** Did scripts return bounded useful evidence rather than raw corpora? Where did direct tool output still flood context? Were large artifacts read repeatedly instead of searched or processed narrowly?
3. **Friction and latency:** Did code mode introduce failures, retries, unnecessary wrappers or extra turns for small tasks? What timing is actually recorded, and what remains unmeasured?
4. **Quality and safety:** Were failures, skipped checks, exact relevant source, omissions, truncation notices and source-revision references preserved? Did editing and independent acceptance remain evidence-based and within role grants?
5. **Context pressure and cost:** How did model input/cache usage and compactions evolve? Account for task size, model, session age and workflow changes rather than treating unrelated sessions as matched benchmarks.
6. **Delegation and workflow:** Were tasks bounded, worker contexts fresh where appropriate, and handoffs concise? Was coordinator growth caused by necessary decisions or avoidable transcripts, logs and repeated packets?
7. **Next decision:** Keep the current rule, clarify it, strengthen the default, or investigate targeted runtime controls? Would Context Mode MCP indexing/retrieval address an observed gap? Keep Billion Context parked unless residual history growth justifies revisiting it.

### Evidence limits and review output

Pi's persisted session history records calls/results, usage, compactions and prompt/tool changes. Nested-call metadata is bounded and nested raw results are not all retained. Retrospective inspection can establish patterns, not exact counterfactual token savings or latency. Use a matched experiment if a precise comparison would change the decision; do not infer savings from output size alone.

Return a concise assessment with concrete session/tool examples, observed benefits, missed opportunities, quality gaps, confounders and one recommended next adjustment (or no change). Propose any rule, configuration or runtime changes for approval. Record the review outcome and active revisions here or in a linked review note, plus Munin, to support the next iteration.

## 2. Context Mode MCP — second priority, if useful

**Status:** Pending; evaluate after the native code-mode baseline.

Use Context Mode's MCP server through Pi's built-in MCP connection, not the Context Mode Pi package/extension or its bundled MCP bridge. The user has previously used this MCP approach successfully in Claude Code; the exact existing server command/version should be inspected before reusing it.

Focus on the additional value of indexing large documents/logs and retrieving relevant passages later. Compare native code mode alone with native code mode plus Context Mode retrieval.

Do not assume MCP-only integration includes the Pi extension's automatic session capture or post-compaction memory injection. Do not grant general Context Mode execution tools to inspection-only roles; choose capabilities explicitly.

## 3. Billion Context — parked fallback

**Status:** Parked; no current need to install or test.

Retain as a candidate only if context saturation persists after bounded tasks, fresh worker contexts, compact evidence-linked handoffs, native code mode, and any justified retrieval integration.

The preferred approach is workflow engineering, not adding a conversation-compression proxy. Revisit only with measured evidence of a remaining conversation-history bottleneck and explicit approval.

If revisited, begin with a coordinator-only trial, disable Billion Context's additional delegation system, avoid coexistence with the legacy `billion-context-pi` compressor, and verify approval/evidence retention, provider transport, recovery, resume behavior, and cache/cost effects.

## Research references

- Native code mode: https://pi.dev/docs/latest/codemode
- Native MCP: https://pi.dev/docs/latest/mcp
- Context Mode: https://github.com/mksglu/context-mode
- Context Mode Pi routing gap: https://github.com/mksglu/context-mode/issues/1069
- Billion Context: https://github.com/ranxianglei/billion-context

Research was static inspection, not runtime compatibility validation. Publisher savings figures are not acceptance targets or guarantees for this workflow.

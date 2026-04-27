/**
 * pi-team — multi-team agent harness as a pi extension.
 *
 * Architecture (Phase 2 redesign):
 *   - The pi main session IS the orchestrator. We replace pi's default coding
 *     prompt with the orchestrator's system prompt + team roster via the
 *     `before_agent_start` hook. Pi's chat UI handles paste, copy, scroll,
 *     history, theming — we build no UI of our own.
 *   - We register a `mention` tool. The orchestrator calls
 *     `mention({ to: "ui-lead", message: "…" })` to address a lead. The tool
 *     spawns the lead in a subprocess, parses the lead's reply for nested
 *     `@<worker>` mentions, recursively spawns workers, and returns the
 *     combined transcript. Pi renders it as a normal tool result.
 *   - Auto-launches when the cwd has `.harness/team.yaml`. No `/team-up`
 *     overlay.
 */

import type {
	ExtensionAPI,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import type { Static } from "typebox";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAgentDef, withReportsTo, withSystemPromptSuffix, type AgentDef } from "./agent-def.ts";
import { makeRuntime, sendToAgent, type AgentRuntime } from "./agent-process.ts";
import { buildRosterPrompt } from "./roster-prompt.ts";
import { buildHarnessFooter, buildRosterHeader, buildTeamFooter } from "./panes.ts";
import { isAddressable, parseAgentMessage } from "./router.ts";
import { loadTeamConfig, type TeamConfig } from "./team-config.ts";
import { loadTeamShape, type TeamShape } from "./team-shape.ts";
import { TillDone } from "./till-done.ts";
import type { TUI } from "@mariozechner/pi-tui";

const EXTENSION_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HARNESS_DIR = resolve(EXTENSION_DIR, "..", "harness");
const MAX_HOPS_PER_DELEGATE = 6;

interface HarnessRuntimeState {
	cwd: string;
	teamCfg: TeamConfig;
	shape: TeamShape;
	orchestrator: AgentDef;
	subagents: AgentRuntime[]; // every non-orchestrator runtime
	all: AgentRuntime[];       // includes a synthetic orchestrator runtime so the
	                            // roster prompts know about it (no spawn ever uses it)
	runDir: string;
	tillDone: TillDone;
}

let harness: HarnessRuntimeState | null = null;
let activeTui: TUI | null = null;

const MentionParams = Type.Object({
	to: Type.String({ description: "Role of the agent to address (e.g. 'ui-lead', 'frontend-worker')" }),
	message: Type.String({ description: "The task / message body. Plain text. The receiver sees `[from @<you>]` automatically." }),
	taskId: Type.Optional(Type.String({ description: "Optional id of the till-done item this mention executes (e.g. 't1' from your prior plan(...) call). The harness marks it in_progress when this call starts and done on success." })),
});

const PlanTaskItem = Type.Object({
	id: Type.String({ description: "Short stable id, e.g. 't1'. Reference this from later mention(taskId) calls." }),
	description: Type.String({ description: "One-line task description shown in the till-done pane." }),
	owner: Type.String({ description: "Role of the agent that will execute this task, e.g. 'ui-lead'." }),
});

const PlanParams = Type.Object({
	tasks: Type.Array(PlanTaskItem, { description: "Full ordered list of tasks for this user request. Replaces any prior plan." }),
});

interface OrchestratorUsage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	turns: number;
}

const orchestratorUsage: OrchestratorUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 };

export default function (pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => {
		try {
			harness = bootHarness(ctx);
			if (!harness) return;

			ctx.ui.notify(
				`[pi-team] harness mode — ${harness.shape.name} (${harness.shape.agents.length} agents). Type to talk to @${harness.orchestrator.role}.`,
				"info",
			);

			// Static roster tree above chat.
			const agents = harness.all;
			const subagents = harness.subagents;
			const tillDone = harness.tillDone;
			ctx.ui.setHeader((_tui, theme) => buildRosterHeader(theme, agents));

			// Below-editor: roster (left) + till-done (right), side-by-side.
			const orchestratorRole = harness.orchestrator.role;
			const orchestratorModel = harness.orchestrator.model;
			ctx.ui.setWidget(
				"pi-team-roster",
				(tui, theme) => {
					activeTui = tui;
					return buildTeamFooter(theme, subagents, tillDone, () => ({
						role: orchestratorRole,
						model: orchestratorModel,
						input: orchestratorUsage.input,
						output: orchestratorUsage.output,
						cacheRead: orchestratorUsage.cacheRead,
						cost: orchestratorUsage.cost,
						turns: orchestratorUsage.turns,
					}));
				},
				{ placement: "belowEditor" },
			);

			// Custom footer: cwd + branch only. Defer so we win against pi-ui's
			// session_start handler in case it runs after ours.
			setImmediate(() => {
				ctx.ui.setFooter((_tui, theme, data) => buildHarnessFooter(theme, ctx.cwd, data.getGitBranch()));
			});
		} catch (err) {
			ctx.ui.notify(`[pi-team] boot failed: ${(err as Error).message}`, "error");
			harness = null;
		}
	});

	pi.on("before_agent_start", () => {
		if (!harness) return undefined;
		// Replace pi's default coding-assistant system prompt with the
		// orchestrator's. Returning systemPrompt swaps it for this turn.
		return { systemPrompt: harness.orchestrator.systemPrompt };
	});

	// Track orchestrator (pi main agent) token spend for the bottom-row usage
	// table. Pi's own session manager doesn't expose totals directly; we
	// accumulate from per-turn message_end events.
	pi.on("message_end", (event) => {
		if (!harness) return;
		const m = event.message;
		if (m.role !== "assistant" || !m.usage) return;
		orchestratorUsage.input += m.usage.input || 0;
		orchestratorUsage.output += m.usage.output || 0;
		orchestratorUsage.cacheRead += m.usage.cacheRead || 0;
		orchestratorUsage.cacheWrite += m.usage.cacheWrite || 0;
		orchestratorUsage.cost += m.usage.cost?.total || 0;
		orchestratorUsage.turns++;
		activeTui?.requestRender();
	});

	pi.registerTool({
		name: "plan",
		label: "Plan",
		description: [
			"Declare your full task plan BEFORE delegating. Each task has an id, a one-line",
			"description, and the role that will execute it. Calling `plan` clears any prior",
			"plan and seeds the till-done list. After this, call `mention(to, message,",
			"taskId)` once per task — the harness checks each task off as it completes.",
		].join(" "),
		promptSnippet: "plan(tasks) — declare full task list upfront; seeds the till-done pane.",
		parameters: PlanParams,
		// Small models occasionally JSON-stringify the array. Be lenient.
		prepareArguments: (args: unknown) => {
			if (args && typeof args === "object" && "tasks" in args) {
				const a = args as { tasks: unknown };
				if (typeof a.tasks === "string") {
					try {
						return { tasks: JSON.parse(a.tasks) } as Static<typeof PlanParams>;
					} catch {
						/* fall through to normal validation */
					}
				}
			}
			return args as Static<typeof PlanParams>;
		},
		async execute(_id, params, _signal, _onUpdate, _ctx) {
			if (!harness) {
				return { content: [{ type: "text", text: "pi-team harness is not active." }], details: null, isError: true };
			}
			harness.tillDone.clear();
			for (const t of params.tasks) {
				harness.tillDone.openWithId(t.id, t.description, t.owner);
			}
			activeTui?.requestRender();
			return {
				content: [{ type: "text", text: `Plan registered: ${params.tasks.length} tasks. Now call mention(...) for each, passing taskId.` }],
				details: { tasks: params.tasks },
			};
		},
	});

	pi.registerTool({
		name: "mention",
		label: "Mention",
		description: [
			"Address another agent in the multi-agent harness chat-room.",
			"Use this whenever you want to write `@<role>` to a lead or peer.",
			"The receiver runs in an isolated subprocess with its own session;",
			"its full reply (including any nested @mentions to workers) is",
			"returned to you as the tool result.",
		].join(" "),
		promptSnippet: "mention(to, message) — address a lead/peer; returns their reply (and any nested worker dispatches).",
		parameters: MentionParams,

		async execute(_toolCallId, params, signal, onUpdate, _ctx) {
			if (!harness) {
				return {
					content: [{ type: "text", text: "pi-team harness is not active in this session." }],
					details: null,
					isError: true,
				};
			}

			const result = await runMentionChain(harness, params, signal, onUpdate);
			return result;
		},
	});

	pi.registerCommand("team-init", {
		description: "Scaffold .harness/team.yaml in the current project (no-op if it already exists).",
		handler: async (_args, ctx) => {
			const harnessDir = resolve(ctx.cwd, ".harness");
			const teamFile = resolve(harnessDir, "team.yaml");
			if (existsSync(teamFile)) {
				ctx.ui.notify(`[pi-team] .harness/team.yaml already exists at ${teamFile} — leaving untouched.`, "warning");
				return;
			}
			mkdirSync(resolve(harnessDir, "expertise"), { recursive: true });
			mkdirSync(resolve(harnessDir, "runs"), { recursive: true });
			writeFileSync(teamFile, DEFAULT_TEAM_YAML, "utf8");
			ctx.ui.notify(
				`[pi-team] wrote ${teamFile}\n` +
					`Edit models/scopes to taste, then exit and re-run \`pi-team\` from this directory.`,
				"info",
			);
		},
	});

	pi.registerCommand("team-down", {
		description: "Archive the current run dir and detach the harness from this session.",
		handler: async (_args, ctx) => {
			if (!harness) {
				ctx.ui.notify("[pi-team] no harness active in this session.", "warning");
				return;
			}
			const archivedAt = harness.runDir;
			harness = null;
			activeTui = null;
			orchestratorUsage.input = 0;
			orchestratorUsage.output = 0;
			orchestratorUsage.cacheRead = 0;
			orchestratorUsage.cacheWrite = 0;
			orchestratorUsage.cost = 0;
			orchestratorUsage.turns = 0;
			ctx.ui.notify(
				`[pi-team] harness detached. Run dir preserved at ${archivedAt}. Restart pi-team to re-enter harness mode.`,
				"info",
			);
		},
	});
}

const DEFAULT_TEAM_YAML = `team_shape: minimal-trio

# Models per tier. provider/model-id format. All listed are free in pi.
# Swap to frontier models once you have provider keys configured.
models:
  orchestrator: opencode/nemotron-3-super-free
  ui-lead: opencode/minimax-m2.5-free
  frontend-worker: opencode/ling-2.6-flash-free

# Scope globs per worker. Honour-system in week 1 — violations logged via
# git diff against main, not enforced at tool level.
scopes:
  frontend-worker: "src/**"
`;

function bootHarness(ctx: ExtensionContext): HarnessRuntimeState | null {
	// Only activate when launched via the `pi-team` wrapper. Plain `pi` stays
	// vanilla even if the cwd contains `.harness/team.yaml`.
	if (process.env.PI_TEAM_HARNESS !== "1") return null;
	const teamCfg = loadTeamConfig(ctx.cwd);
	if (!teamCfg) return null;

	const shape = loadTeamShape(HARNESS_DIR, teamCfg.teamShape);

	const runId = new Date().toISOString().replace(/[:.]/g, "-");
	const runDir = resolve(ctx.cwd, ".harness", "runs", runId);
	mkdirSync(runDir, { recursive: true });

	// Build agent definitions for every role. Orchestrator stays as a definition
	// only — we don't spawn it; pi's main session IS the orchestrator. Other
	// agents become AgentRuntime (one subprocess per role, lazily spawned on
	// first turn).
	const defsByRole = new Map<string, AgentDef>();
	for (const spec of shape.agents) {
		const base = loadAgentDef(HARNESS_DIR, spec.definition, spec.role);
		const modelOverride = teamCfg.models[spec.role];
		const def = withReportsTo(base, spec.reportsTo);
		if (modelOverride) def.model = modelOverride;
		defsByRole.set(spec.role, def);
	}

	const orchestratorDef = [...defsByRole.values()].find((d) => d.tier === "orchestrator");
	if (!orchestratorDef) throw new Error("Team shape has no orchestrator role");

	// Synthetic runtime entries used only for roster rendering.
	const all: AgentRuntime[] = shape.agents.map((spec) => makeRuntime(defsByRole.get(spec.role)!, runDir));
	const subagents = all.filter((r) => r.def.tier !== "orchestrator");

	// Inject the roster prompt into every agent (including the orchestrator
	// definition we use for pi's system prompt).
	const orchestratorWithRoster: AgentDef = withSystemPromptSuffix(
		orchestratorDef,
		buildRosterPrompt(
			all.find((r) => r.def.role === orchestratorDef.role)!,
			all,
			teamCfg.scopes,
			{ dispatchMode: "tool" },
		),
	);
	for (const r of subagents) {
		r.def = withSystemPromptSuffix(r.def, buildRosterPrompt(r, all, teamCfg.scopes, { dispatchMode: "text" }));
	}

	return {
		cwd: ctx.cwd,
		teamCfg,
		shape,
		orchestrator: orchestratorWithRoster,
		subagents,
		all,
		runDir,
		tillDone: new TillDone(),
	};
}

interface ChainTranscriptItem {
	from: string;
	to: string;
	text: string;
	exitCode: number;
}

async function runMentionChain(
	state: HarnessRuntimeState,
	params: Static<typeof MentionParams>,
	signal: AbortSignal | undefined,
	onUpdate: ((partial: { content: { type: "text"; text: string }[]; details: unknown }) => void) | undefined,
): Promise<{ content: { type: "text"; text: string }[]; details: unknown; isError?: boolean }> {
	const transcript: ChainTranscriptItem[] = [];

	type QueueItem = { from: string; toRole: string; body: string; hop: number; tillDoneId?: string };
	let initialId: string | undefined;
	if (params.taskId && state.tillDone.markInProgress(params.taskId)) {
		initialId = params.taskId;
	} else if (state.tillDone.all().length === 0) {
		// No plan declared at all — fall back to an implicit item so usage
		// without plan() still tracks something.
		const implicit = state.tillDone.open(briefDescription(params.message), params.to);
		initialId = implicit.id;
	} else {
		// Plan exists but caller didn't pass a known taskId. Reject hard so the
		// orchestrator learns to pass taskId on every mention.
		const known = state.tillDone.all().map((i) => `${i.id}=${i.description}`).join(", ");
		return {
			content: [{
				type: "text",
				text: `mention rejected: taskId is required when a plan exists, and "${params.taskId ?? ""}" was not in the plan. Known tasks: ${known}. Pass taskId from your plan(...) call.`,
			}],
			details: null,
			isError: true,
		};
	}
	activeTui?.requestRender();
	const queue: QueueItem[] = [{ from: "orchestrator", toRole: params.to, body: params.message, hop: 0, tillDoneId: initialId }];
	let hardError: string | null = null;

	while (queue.length > 0) {
		const item = queue.shift()!;
		if (item.hop >= MAX_HOPS_PER_DELEGATE) {
			transcript.push({ from: "system", to: "system", text: `(hop cap ${MAX_HOPS_PER_DELEGATE} reached — halting chain)`, exitCode: 0 });
			break;
		}

		const target = state.subagents.find((r) => r.def.role === item.toRole);
		if (!target) {
			transcript.push({ from: "system", to: item.toRole, text: `(off-roster: unknown role @${item.toRole})`, exitCode: 1 });
			continue;
		}

		// For non-orchestrator senders, validate addressability against the graph.
		if (item.from !== "orchestrator") {
			const fromRt = state.subagents.find((r) => r.def.role === item.from);
			if (fromRt && !isAddressable(fromRt, item.toRole, state.subagents)) {
				transcript.push({
					from: "system",
					to: item.toRole,
					text: `(off-roster: @${item.from} cannot address @${item.toRole})`,
					exitCode: 1,
				});
				continue;
			}
		}

		const promptForAgent = `[from @${item.from}]\n${item.body}`;

		emitProgress(`spawning @${item.toRole}…`);

		let stderrBuf = "";
		const result = await sendToAgent(target, {
			cwd: state.cwd,
			prompt: promptForAgent,
			signal,
			onTextDelta: (delta) => {
				emitProgress(`@${item.toRole} streaming: …${delta.slice(-60)}`);
			},
			onThinkingDelta: () => {},
			onStderr: (chunk) => {
				stderrBuf += chunk;
			},
		});

		transcript.push({ from: item.from, to: item.toRole, text: result.text, exitCode: result.exitCode });
		activeTui?.requestRender();

		if (result.exitCode !== 0) {
			if (item.tillDoneId) state.tillDone.markFailed(item.tillDoneId);
			hardError = `@${item.toRole} exited ${result.exitCode}: ${(stderrBuf || "(no stderr)").slice(0, 300)}`;
			activeTui?.requestRender();
			break;
		}

		// Parse the agent's reply for nested mentions and explicit done: ids.
		const parsed = parseAgentMessage(result.text);
		for (const dispatch of parsed.dispatches) {
			// Nested @<role> from a lead doesn't get a new till-done item by
			// default — the orchestrator's plan(...) call already declared the
			// real list. Only add an implicit child item if there's no plan.
			const planExists = state.tillDone.all().length > 0;
			const childId = planExists
				? undefined
				: state.tillDone.open(briefDescription(dispatch.body), dispatch.toRole).id;
			queue.push({ from: item.toRole, toRole: dispatch.toRole, body: dispatch.body, hop: item.hop + 1, tillDoneId: childId });
		}
		for (const id of parsed.doneIds) state.tillDone.markDone(id);

		if (item.tillDoneId) state.tillDone.markDone(item.tillDoneId);
		activeTui?.requestRender();
	}

	const rendered = renderTranscript(transcript);
	if (hardError) {
		return {
			content: [{ type: "text", text: `${rendered}\n\nERROR: ${hardError}` }],
			details: transcript,
			isError: true,
		};
	}
	return { content: [{ type: "text", text: rendered }], details: transcript };

	function emitProgress(status: string) {
		if (!onUpdate) return;
		onUpdate({
			content: [{ type: "text", text: `${renderTranscript(transcript)}\n\n…${status}` }],
			details: transcript,
		});
	}
}

function renderTranscript(items: ChainTranscriptItem[]): string {
	return items.map((it) => {
		const head = `── @${it.to} ◀ @${it.from} ──`;
		return `${head}\n${it.text.trim()}`;
	}).join("\n\n");
}

function briefDescription(text: string): string {
	const firstLine = text.trim().split("\n")[0] ?? "";
	if (firstLine.length <= 60) return firstLine;
	return firstLine.slice(0, 57) + "…";
}

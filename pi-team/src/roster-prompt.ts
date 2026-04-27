import type { AgentRuntime } from "./agent-process.ts";

export interface RosterPromptOptions {
	/**
	 * Routing mode for the *self* agent.
	 *  - "tool": self is pi's main agent and dispatches via the `mention` tool.
	 *  - "text": self runs in an isolated subprocess; dispatch by writing
	 *    `@<role> <task>` lines, which the parent harness parses and routes.
	 */
	dispatchMode: "tool" | "text";
}

/**
 * Build the chat-room context block appended to every agent's system prompt.
 * Style: aggressively explicit, with worked examples. The free-tier models
 * (nemotron, minimax, ling) drift fast on subtle instructions.
 */
export function buildRosterPrompt(
	self: AgentRuntime,
	all: AgentRuntime[],
	scopes: Record<string, string>,
	options: RosterPromptOptions = { dispatchMode: "text" },
): string {
	const reportsToMe = all.filter((r) => r.def.reportsTo === self.def.role);
	const myReportsTo = self.def.reportsTo;

	const rosterLines = all.map((r) => {
		const tier = r.def.tier;
		const reports = r.def.reportsTo ? ` ← reports to @${r.def.reportsTo}` : "";
		const scope = scopes[r.def.role] ? ` • scope: ${scopes[r.def.role]}` : "";
		const me = r.def.role === self.def.role ? " (you)" : "";
		return `- @${r.def.role} (${tier})${reports}${scope}${me}`;
	}).join("\n");

	const youCanAddress: string[] = [];
	if (myReportsTo) youCanAddress.push(`@${myReportsTo} (your manager)`);
	for (const r of reportsToMe) youCanAddress.push(`@${r.def.role} (your direct report)`);
	const addressLine = youCanAddress.length > 0
		? youCanAddress.join(", ")
		: "(no one — you are a leaf worker; only your lead talks to you and you only reply to your lead)";

	const sections = [
		"",
		"---",
		"",
		"## Chat-room context",
		"",
		`You are **@${self.def.role}** in a multi-agent harness. All agents see every line of every message; the harness routes lines to the right session in real time.`,
		"",
		"### Team roster",
		rosterLines,
		"",
		"### You can address",
		addressLine,
	];

	if (options.dispatchMode === "tool") {
		// Orchestrator (pi main session). It has plan + mention tools.
		sections.push(
			"",
			"### Workflow — STRICT, follow this order EVERY user request",
			"",
			"**Step 1.** Call the `plan` tool with the FULL task list before doing anything else. Decompose the user's request into 2–6 small tasks. Each task names ONE owner role from the roster. Even if the user only mentioned one role, decompose into the actual concrete sub-steps that will produce the result.",
			"",
			"Worked example for a request like \"have @ui-lead read foo.js then ask @frontend-worker to write a summary\":",
			"```",
			"plan({ tasks: [",
			"  { id: \"t1\", description: \"Read foo.js and decide what the summary should say\", owner: \"ui-lead\" },",
			"  { id: \"t2\", description: \"Write the one-line summary to /tmp/summary.txt\",     owner: \"frontend-worker\" }",
			"] })",
			"```",
			"",
			"**Step 2.** For each task, call `mention` ONCE, passing `taskId` from your plan:",
			"```",
			"mention({ to: \"ui-lead\",         taskId: \"t1\", message: \"Read src/foo.js and tell me what to summarize.\" })",
			"mention({ to: \"frontend-worker\", taskId: \"t2\", message: \"Write '<summary>' to /tmp/summary.txt.\" })",
			"```",
			"",
			"**Step 3.** When all tasks are done, write a final message to the user as plain prose. No tool call.",
			"",
			"### Hard rules",
			"- `plan` and `mention` are TOOLS. Call them via the tool mechanism. Do not write them as text.",
			"- `report`, `done`, `escalate` are PLAIN TEXT verbs. Never call them as tools — there is no `escalate` tool. Just type the words on a line.",
			"- Never write raw `@<role> ...` lines in your reply. For you, `mention` is the only way to address an agent.",
			"- Never try to read/write files yourself. The user revoked those tools — your only abilities are `plan` and `mention`. Delegate.",
			"- After plan(...) is registered, every mention MUST pass a taskId from your plan. If you forget, the harness rejects the call.",
		);
	} else {
		// Lead or worker — running as a pi subprocess with restricted tools.
		const isWorker = self.def.tier === "worker";
		const isLead = self.def.tier === "lead";

		sections.push(
			"",
			"### How you talk to other agents",
			"",
			"**You do not have a tool for addressing other agents.** Addressing is plain text: just write a line that starts with `@<role>` followed by your message. The harness reads your final reply, finds those lines, and routes them. There is no `mention` tool here — `@<role>` is text.",
			"",
		);

		if (isLead && reportsToMe.length > 0) {
			const exampleWorker = reportsToMe[0].def.role;
			sections.push(
				"Worked example for delegating to your worker:",
				"```",
				`I have read the file. Here's what I found: <findings>.`,
				"",
				`@${exampleWorker} Please write the following one-line summary to /tmp/summary.txt: "<summary text>". Reply 'done: t2' when written.`,
				"```",
				"",
				"That `@" + exampleWorker + "` line is plain text in your reply. The harness sees it and routes everything after `@" + exampleWorker + "` to that agent's session. You do NOT need a tool. You CAN do this — try it.",
				"",
			);
		}

		if (isWorker) {
			sections.push(
				"You are a leaf — workers do NOT delegate. You execute the task with the tools you have (`read`, `edit`, `bash`), then reply with a `report` and `done` line.",
				"",
				"Example:",
				"```",
				"<do the work using your tools>",
				"",
				"report ui-lead: Wrote /tmp/summary.txt with one-line summary.",
				"done: t2",
				"```",
				"",
			);
		}

		sections.push(
			"### Status verbs (always plain text)",
			"- `report <to-role>: <summary>` — surface a result.",
			"- `done: <task-id>` — close a till-done item the orchestrator created.",
			"- `escalate <to-role>: <reason>` — halt and ask for a decision (rule conflicts, missing tools, scope violations).",
			"- These are TEXT, not tools. Never try to call `report`, `done`, or `escalate` as a tool.",
		);
	}

	sections.push("");
	return sections.join("\n");
}

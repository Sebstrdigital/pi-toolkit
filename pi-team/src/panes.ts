import type { Theme } from "@mariozechner/pi-coding-agent";
import { Container, Text, truncateToWidth, visibleWidth, type Component } from "@mariozechner/pi-tui";
import type { AgentRuntime } from "./agent-process.ts";
import type { TillDone } from "./till-done.ts";

/** Header: static roster tree printed above pi's chat. */
export function buildRosterHeader(theme: Theme, agents: AgentRuntime[]): Component {
	const container = new Container();
	const title = `${theme.fg("accent", "🛰  pi-team")} ${theme.fg("muted", `— ${agents.length} agents`)}`;
	container.addChild(new Text(title, 0, 0));

	const byParent = new Map<string | undefined, AgentRuntime[]>();
	for (const a of agents) {
		const key = a.def.reportsTo;
		if (!byParent.has(key)) byParent.set(key, []);
		byParent.get(key)!.push(a);
	}

	const walk = (parent: string | undefined, depth: number) => {
		const kids = byParent.get(parent) ?? [];
		for (const a of kids) {
			const indent = "  ".repeat(depth);
			const arrow = depth === 0 ? "" : "└─ ";
			const tier = theme.fg("muted", `(${a.def.tier})`);
			const role = theme.fg(colorForTier(a.def.tier), `@${a.def.role}`);
			const model = a.def.model ? theme.fg("dim", ` • ${a.def.model}`) : "";
			container.addChild(new Text(`${indent}${arrow}${role} ${tier}${model}`, 0, 0));
			walk(a.def.role, depth + 1);
		}
	};
	walk(undefined, 0);

	return container;
}

export interface OrchestratorUsageView {
	role: string;
	model?: string;
	input: number;
	output: number;
	cacheRead: number;
	cost: number;
	turns: number;
	contextTokens: number;
}

/**
 * Below-editor widget: two columns side-by-side.
 *  - Left: per-agent token / cost roster (orchestrator + subagents) with the
 *    cwd/branch tail appended to the summary line.
 *  - Right: till-done list with `[N/M]` header.
 */
export function buildTeamFooter(
	theme: Theme,
	subagents: AgentRuntime[],
	tillDone: TillDone,
	orchestrator: () => OrchestratorUsageView,
	location: { cwd: string; branch: string | null },
	activeRoles: () => ReadonlySet<string> = () => new Set(),
): Component {
	return new TeamFooter(theme, subagents, tillDone, orchestrator, location, activeRoles);
}

class TeamFooter implements Component {
	constructor(
		private theme: Theme,
		private subagents: AgentRuntime[],
		private tillDone: TillDone,
		private orchestrator: () => OrchestratorUsageView,
		private location: { cwd: string; branch: string | null },
		private activeRoles: () => ReadonlySet<string>,
	) {}

	render(width: number): string[] {
		const th = this.theme;
		const colW = Math.max(20, Math.floor((width - 3) / 2));
		const left = this.renderRoster(colW).map((l) => truncateToWidth(l, colW));
		const right = this.renderTillDone(colW).map((l) => truncateToWidth(l, colW));
		const rows = Math.max(left.length, right.length);
		const lines: string[] = [];
		const sep = th.fg("border", " │ ");
		for (let i = 0; i < rows; i++) {
			const l = pad(left[i] ?? "", colW);
			const r = right[i] ?? "";
			const line = `${l}${sep}${r}`;
			// Final safety clip — even after per-column truncation, the joined
			// line could exceed the available width by a hair due to ANSI/visible
			// length mismatches. pi-tui hard-fails on overflow, so clamp.
			lines.push(visibleWidth(line) > width ? truncateToWidth(line, width) : line);
		}
		return lines;
	}

	private renderRoster(_width: number): string[] {
		const th = this.theme;
		const lines: string[] = [];
		const orch = this.orchestrator();

		let totalIn = orch.input + orch.cacheRead;
		let totalOut = orch.output;
		let totalCost = orch.cost;
		for (const a of this.subagents) {
			totalIn += a.usage.input + a.usage.cacheRead;
			totalOut += a.usage.output;
			totalCost += a.usage.cost;
		}

		const home = process.env.HOME ?? "";
		const shortCwd = home && this.location.cwd.startsWith(home)
			? `~${this.location.cwd.slice(home.length)}`
			: this.location.cwd;
		const branchPart = this.location.branch
			? th.fg("muted", " (") + th.fg("accent", this.location.branch) + th.fg("muted", ")")
			: "";

		lines.push(
			th.fg("accent", "team") +
				th.fg("muted", " • ") +
				th.fg("text", `${fmt(totalIn)}↑ ${fmt(totalOut)}↓`) +
				th.fg("muted", " • ") +
				th.fg("text", totalCost > 0 ? `$${totalCost.toFixed(4)}` : "FREE") +
				"   " +
				th.fg("text", shortCwd) +
				branchPart,
		);

		const active = this.activeRoles();
		const renderRow = (role: string, tier: AgentRuntime["def"]["tier"], _turns: number, input: number, cacheRead: number, output: number, cost: number, ctx: number, indent: number, isLast: boolean) => {
			const pad = "  ".repeat(indent);
			const arrow = indent === 0 ? "" : (isLast ? "└─ " : "├─ ");
			const marker = active.has(role) ? th.fg("warning", "⚡ ") : "  ";
			const r = th.fg(colorForTier(tier), `@${role}`);
			const i = th.fg("text", `${fmt(input + cacheRead)}↑`);
			const o = th.fg("text", `${fmt(output)}↓`);
			const ctxPart = ctx > 0 ? " " + th.fg("muted", `🧠 ${ctxFreePct(ctx)}% free`) : "";
			const c = cost > 0 ? " " + th.fg("text", `$${cost.toFixed(4)}`) : "";
			return `  ${pad}${arrow}${marker}${r} ${i} ${o}${ctxPart}${c}`;
		};

		// Build a tree by reportsTo so the roster matches the header layout.
		const childrenOf = new Map<string | undefined, AgentRuntime[]>();
		for (const r of this.subagents) {
			const key = r.def.reportsTo;
			if (!childrenOf.has(key)) childrenOf.set(key, []);
			childrenOf.get(key)!.push(r);
		}

		lines.push(renderRow(orch.role, "orchestrator", orch.turns, orch.input, orch.cacheRead, orch.output, orch.cost, orch.contextTokens, 0, true));

		const walk = (parent: string | undefined, depth: number) => {
			const kids = childrenOf.get(parent) ?? [];
			kids.forEach((r, idx) => {
				const isLast = idx === kids.length - 1;
				lines.push(renderRow(r.def.role, r.def.tier, r.usage.turns, r.usage.input, r.usage.cacheRead, r.usage.output, r.usage.cost, r.usage.contextTokens, depth, isLast));
				walk(r.def.role, depth + 1);
			});
		};
		walk(orch.role, 1);

		return lines;
	}

	private renderTillDone(_width: number): string[] {
		const th = this.theme;
		const items = this.tillDone.all();
		const { done, total } = this.tillDone.progress();
		const lines: string[] = [];
		const headerLabel = total === 0 ? "till-done" : `till-done [${done}/${total}]`;
		lines.push(th.fg("accent", headerLabel));
		if (items.length === 0) {
			lines.push(th.fg("muted", "  (no tasks yet)"));
			return lines;
		}
		for (const item of items) {
			const icon = iconFor(item.state, th);
			const id = th.fg("muted", item.id);
			const desc = th.fg(item.state === "done" ? "muted" : "text", item.description);
			const owner = th.fg("dim", `@${item.owner}`);
			lines.push(`  ${icon} ${id} ${desc} ${owner}`);
		}
		return lines;
	}

	invalidate(): void {}
	dispose(): void {}
}

function pad(s: string, len: number): string {
	// Visible width is hard to measure perfectly with ANSI; use a conservative
	// fallback by stripping ANSI and padding to len.
	const visible = s.replace(/\x1b\[[0-9;]*m/g, "");
	const padding = Math.max(0, len - visible.length);
	return s + " ".repeat(padding);
}

function fmt(n: number): string {
	if (n < 1000) return n.toString();
	if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
	if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
	return `${(n / 1_000_000).toFixed(1)}M`;
}

// Default context window for the free-tier OpenCode models we ship with.
// TODO: source per-model from team.yaml when leads/workers have varying caps.
const DEFAULT_CTX_WINDOW = 128_000;

function ctxFreePct(used: number): number {
	const free = Math.max(0, DEFAULT_CTX_WINDOW - used);
	return Math.round((free / DEFAULT_CTX_WINDOW) * 100);
}

function colorForTier(tier: AgentRuntime["def"]["tier"]): "success" | "warning" | "thinkingText" {
	if (tier === "orchestrator") return "success";
	if (tier === "lead") return "warning";
	return "thinkingText";
}

/** Raw ANSI used inside transcripts (rendered as tool-result text — no Theme there). */
const ANSI = {
	reset: "\x1b[0m",
	orchestrator: "\x1b[32m",   // green
	lead: "\x1b[33m",            // yellow
	worker: "\x1b[36m",          // cyan
	system: "\x1b[90m",          // grey
};

export function ansiForTier(tier: AgentRuntime["def"]["tier"] | "system"): string {
	if (tier === "orchestrator") return ANSI.orchestrator;
	if (tier === "lead") return ANSI.lead;
	if (tier === "worker") return ANSI.worker;
	return ANSI.system;
}

export const ANSI_RESET = ANSI.reset;

/** Footer (replaces pi-ui's): only cwd + branch, centered. */
export function buildHarnessFooter(theme: Theme, cwd: string, branch: string | null): Component {
	const home = process.env.HOME ?? "";
	const shortCwd = home && cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
	const branchPart = branch ? theme.fg("muted", " (") + theme.fg("accent", branch) + theme.fg("muted", ")") : "";
	const text = theme.fg("text", shortCwd) + branchPart;
	return new CenteredText(text);
}

class CenteredText implements Component {
	constructor(private text: string) {}
	render(width: number): string[] {
		const visible = this.text.replace(/\x1b\[[0-9;]*m/g, "");
		const pad = Math.max(0, Math.floor((width - visible.length) / 2));
		return [" ".repeat(pad) + this.text];
	}
	invalidate(): void {}
	dispose(): void {}
}

function iconFor(state: "open" | "in_progress" | "done" | "failed", th: Theme): string {
	switch (state) {
		case "done": return th.fg("success", "✓");
		case "failed": return th.fg("error", "✗");
		case "in_progress": return th.fg("warning", "●");
		case "open": return th.fg("muted", "○");
	}
}

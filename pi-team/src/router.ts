import type { AgentRuntime } from "./agent-process.ts";

/**
 * Parse a completed agent message for `@<role>` mentions and `report:` /
 * `done:` / `escalate:` status verbs.
 *
 * Convention (see harness/vocabulary.md):
 *   @<role> <free-text>      — route everything from `@role` until the next
 *                              `@<other-role>` or status verb to that agent.
 *   report <to>: <summary>   — surfaces upward; routed to <to> as a message.
 *   done: <task-id>          — closes a till-done item (Phase 4).
 *   escalate <to>: <reason>  — halts; routed to <to> with priority marker.
 */

export interface MentionDispatch {
	toRole: string;
	body: string;
	kind: "mention" | "report" | "escalate";
}

export interface RouterParseResult {
	dispatches: MentionDispatch[];
	doneIds: string[];
}

const MENTION_RE = /^@([A-Za-z][\w-]*)\b/;
const REPORT_RE = /^report\s+@?([A-Za-z][\w-]*)\s*:\s*(.*)$/i;
const ESCALATE_RE = /^escalate\s+@?([A-Za-z][\w-]*)\s*:\s*(.*)$/i;
const DONE_RE = /^done\s*:\s*(\S+)/i;

export function parseAgentMessage(text: string): RouterParseResult {
	const dispatches: MentionDispatch[] = [];
	const doneIds: string[] = [];
	const lines = text.split("\n");

	let activeMention: { role: string; buffer: string[] } | null = null;

	const flush = () => {
		if (!activeMention) return;
		const body = activeMention.buffer.join("\n").trim();
		if (body) {
			dispatches.push({ toRole: activeMention.role, body, kind: "mention" });
		}
		activeMention = null;
	};

	for (const rawLine of lines) {
		const line = rawLine.trim();

		const reportMatch = line.match(REPORT_RE);
		if (reportMatch) {
			flush();
			dispatches.push({ toRole: reportMatch[1], body: reportMatch[2].trim(), kind: "report" });
			continue;
		}

		const escMatch = line.match(ESCALATE_RE);
		if (escMatch) {
			flush();
			dispatches.push({ toRole: escMatch[1], body: `(escalation) ${escMatch[2].trim()}`, kind: "escalate" });
			continue;
		}

		const doneMatch = line.match(DONE_RE);
		if (doneMatch) {
			flush();
			doneIds.push(doneMatch[1]);
			continue;
		}

		const mentionMatch = line.match(MENTION_RE);
		if (mentionMatch) {
			flush();
			const role = mentionMatch[1];
			const remainder = line.slice(mentionMatch[0].length).trim();
			activeMention = { role, buffer: remainder ? [remainder] : [] };
			continue;
		}

		if (activeMention) activeMention.buffer.push(rawLine);
	}
	flush();

	return { dispatches, doneIds };
}

/**
 * Validate a dispatch against the addressable graph. Workers can only address
 * their lead; leads can address their workers and their orchestrator;
 * orchestrator can address all leads. Off-roster dispatches are dropped.
 */
export function isAddressable(from: AgentRuntime, toRole: string, all: AgentRuntime[]): boolean {
	if (from.def.role === toRole) return false;
	const target = all.find((r) => r.def.role === toRole);
	if (!target) return false;

	// Up-the-chain: agent can address its manager.
	if (from.def.reportsTo === toRole) return true;

	// Down-the-chain: agent can address its direct reports.
	if (target.def.reportsTo === from.def.role) return true;

	return false;
}

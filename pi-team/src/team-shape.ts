import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface TeamAgent {
	role: string;
	definition: string;
	reportsTo?: string;
}

export interface TeamShape {
	name: string;
	description: string;
	agents: TeamAgent[];
}

/**
 * Hand-rolled parser for `harness/teams/<shape>.yaml`. The schema is small —
 * see `harness/teams/minimal-trio.yaml` for the canonical example.
 *
 *   name: minimal-trio
 *   agents:
 *     - role: orchestrator
 *       definition: agents/orchestrator.md
 *     - role: ui-lead
 *       definition: agents/leads/generic-lead.md
 *       reports_to: orchestrator
 */
export function loadTeamShape(harnessDir: string, shapeName: string): TeamShape {
	const path = join(harnessDir, "teams", `${shapeName}.yaml`);
	const raw = readFileSync(path, "utf8");
	const lines = raw.split("\n");

	let name = "";
	let description = "";
	const agents: TeamAgent[] = [];
	let inAgents = false;
	let current: Partial<TeamAgent> | null = null;

	const finalize = () => {
		if (current && current.role && current.definition) {
			agents.push({ role: current.role, definition: current.definition, reportsTo: current.reportsTo });
		}
		current = null;
	};

	for (const line of lines) {
		if (!line.trim() || line.trimStart().startsWith("#")) continue;

		// Top-level key.
		const top = line.match(/^(\w+):\s*(.*)$/);
		if (top) {
			finalize();
			inAgents = false;
			const key = top[1];
			const rest = top[2].trim();
			if (key === "name") name = unquote(rest);
			else if (key === "description") description = unquote(rest);
			else if (key === "agents") inAgents = true;
			continue;
		}

		if (!inAgents) continue;

		// New list item: "- role: <name>"
		const item = line.match(/^\s*-\s+(\w+):\s*(.*)$/);
		if (item) {
			finalize();
			current = {};
			setField(current, item[1], unquote(item[2].trim()));
			continue;
		}

		// Field of current item.
		const field = line.match(/^\s+(\w+):\s*(.*)$/);
		if (field && current) setField(current, field[1], unquote(field[2].trim()));
	}
	finalize();

	if (!name) throw new Error(`team shape missing 'name': ${path}`);
	if (agents.length === 0) throw new Error(`team shape has no agents: ${path}`);
	return { name, description, agents };
}

function setField(target: Partial<TeamAgent>, key: string, value: string): void {
	if (key === "role") target.role = value;
	else if (key === "definition") target.definition = value;
	else if (key === "reports_to" || key === "reportsTo") target.reportsTo = value;
}

function unquote(s: string): string {
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return s.slice(1, -1);
	}
	return s;
}

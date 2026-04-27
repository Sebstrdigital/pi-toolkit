import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface TeamConfig {
	teamShape: string;
	models: Record<string, string>;
	scopes: Record<string, string>;
}

/**
 * Minimal hand-rolled parser for `.harness/team.yaml`. Only handles the schema
 * we actually emit (see harness/teams/minimal-trio.yaml + team-harness-layout.md §3.1).
 *
 *   team_shape: minimal-trio
 *   models:
 *     orchestrator: nemotron-3-super
 *     ...
 *   scopes:
 *     frontend-worker: "src/**"
 *
 * No anchors, no flow style, no nested lists. We add a real YAML dep when this
 * outgrows hand-rolling.
 */
export function loadTeamConfig(cwd: string): TeamConfig | null {
	const path = join(cwd, ".harness", "team.yaml");
	if (!existsSync(path)) return null;

	const raw = readFileSync(path, "utf8");
	const lines = raw.split("\n");
	const cfg: TeamConfig = { teamShape: "", models: {}, scopes: {} };

	let section: "models" | "scopes" | null = null;
	for (const line of lines) {
		if (!line.trim() || line.trimStart().startsWith("#")) continue;

		const top = line.match(/^(\w+):\s*(.*)$/);
		if (top) {
			section = null;
			const key = top[1];
			const rest = top[2].trim();
			if (key === "team_shape") cfg.teamShape = unquote(rest);
			else if (key === "models" && rest === "") section = "models";
			else if (key === "scopes" && rest === "") section = "scopes";
			continue;
		}

		const indented = line.match(/^\s+(\S+):\s*(.*)$/);
		if (indented && section) {
			const key = indented[1];
			const value = unquote(indented[2].trim());
			if (section === "models") cfg.models[key] = value;
			else if (section === "scopes") cfg.scopes[key] = value;
		}
	}

	return cfg;
}

function unquote(s: string): string {
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return s.slice(1, -1);
	}
	return s;
}

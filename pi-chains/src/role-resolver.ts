import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { RoleDef } from "./types.ts";

/**
 * Locate a role's SKILL.md and parse its allowed-tools frontmatter.
 *
 * Search order (matches pi's own discovery, focused on the locations pi-toolkit uses):
 *   1. ~/.pi/agent/skills/<role>/SKILL.md
 *   2. ~/.agents/skills/<role>/SKILL.md
 *   3. <cwd>/.pi/skills/<role>/SKILL.md
 *   4. <cwd>/.agents/skills/<role>/SKILL.md
 *
 * pi-toolkit's install.sh symlinks pi-roles/<name> into ~/.pi/agent/skills/, so case 1
 * is the expected hit for chain-shipped roles.
 */
export function resolveRole(name: string, cwd: string): RoleDef {
	const candidates = [
		join(homedir(), ".pi", "agent", "skills", name, "SKILL.md"),
		join(homedir(), ".agents", "skills", name, "SKILL.md"),
		join(cwd, ".pi", "skills", name, "SKILL.md"),
		join(cwd, ".agents", "skills", name, "SKILL.md"),
	];
	for (const path of candidates) {
		if (existsSync(path) && statSync(path).isFile()) {
			return { name, skillPath: path, allowedTools: parseAllowedTools(readFileSync(path, "utf8")) };
		}
	}
	throw new Error(
		`role '${name}' not found. Searched:\n${candidates.map((c) => `  - ${c}`).join("\n")}`,
	);
}

export function listInstalledRoles(cwd: string): string[] {
	const dirs = [
		join(homedir(), ".pi", "agent", "skills"),
		join(homedir(), ".agents", "skills"),
		join(cwd, ".pi", "skills"),
		join(cwd, ".agents", "skills"),
	];
	const seen = new Set<string>();
	for (const dir of dirs) {
		if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
		for (const entry of readdirSync(dir)) {
			const skillPath = join(dir, entry, "SKILL.md");
			if (existsSync(skillPath)) seen.add(entry);
		}
	}
	return Array.from(seen).sort();
}

function parseAllowedTools(skillBody: string): string {
	// Frontmatter is a YAML block fenced by '---' lines at the top of the file.
	const match = skillBody.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return "";
	const fm = match[1];
	const line = fm.split("\n").find((l) => l.match(/^allowed-tools:\s*/));
	if (!line) return "";
	const value = line.replace(/^allowed-tools:\s*/, "").trim();
	// allowed-tools is space-delimited per the pi spec; convert to CSV for --tools.
	return value.split(/\s+/).filter(Boolean).join(",");
}

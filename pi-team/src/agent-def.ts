import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface AgentDef {
	role: string;
	tier: "orchestrator" | "lead" | "worker";
	model?: string;
	tools: string[];
	systemPrompt: string;
	reportsTo?: string;
}

/**
 * Read a harness/agents/<file>.md, split frontmatter + body. Frontmatter is
 * YAML-ish but small enough for hand parsing — same approach as pi-roles.
 *
 * Frontmatter keys we read: name, tier, model, tools (csv list).
 * Body becomes the system prompt passed to pi via --append-system-prompt.
 */
export function loadAgentDef(harnessDir: string, definitionPath: string, role: string): AgentDef {
	const abs = resolve(harnessDir, definitionPath);
	if (!existsSync(abs)) {
		throw new Error(`Agent definition not found: ${abs}`);
	}
	const raw = readFileSync(abs, "utf8");

	const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!fmMatch) {
		throw new Error(`Agent definition missing frontmatter: ${abs}`);
	}
	const frontmatter = fmMatch[1];
	const body = fmMatch[2];

	const fields: Record<string, string> = {};
	for (const line of frontmatter.split("\n")) {
		const m = line.match(/^(\w+):\s*(.*)$/);
		if (m) fields[m[1]] = m[2].trim();
	}

	const tier = (fields.tier ?? "worker") as AgentDef["tier"];
	const model = fields.model && fields.model !== "" ? fields.model : undefined;
	const tools = parseToolsList(fields.tools ?? "[]");
	const skills = parseToolsList(fields.skills ?? "[]");

	const skillBodies = skills.map((name) => loadSkillBody(harnessDir, name));
	const fullPrompt = [body.trim(), ...skillBodies].filter(Boolean).join("\n\n---\n\n");

	return { role, tier, model, tools, systemPrompt: fullPrompt };
}

function loadSkillBody(harnessDir: string, skillName: string): string {
	const path = resolve(harnessDir, "skills", `${skillName}.md`);
	if (!existsSync(path)) {
		throw new Error(`Skill not found: ${path}. Add the file or remove the skill from the agent's frontmatter.`);
	}
	const raw = readFileSync(path, "utf8");
	const fmMatch = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
	return (fmMatch ? fmMatch[1] : raw).trim();
}

export function withReportsTo(def: AgentDef, reportsTo: string | undefined): AgentDef {
	return { ...def, reportsTo };
}

export function withSystemPromptSuffix(def: AgentDef, suffix: string): AgentDef {
	return { ...def, systemPrompt: `${def.systemPrompt}\n${suffix}` };
}

function parseToolsList(raw: string): string[] {
	const inner = raw.replace(/^\[/, "").replace(/\]$/, "").trim();
	if (!inner) return [];
	return inner.split(",").map((s) => s.trim()).filter(Boolean);
}

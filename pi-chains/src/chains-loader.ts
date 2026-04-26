import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ChainDef, ChainStep } from "./types.ts";

/**
 * Chain discovery order (later entries override earlier ones by name):
 *   1. <extension>/examples/         — built-in defaults
 *   2. ~/.pi-chains/chains/          — user global
 *   3. <cwd>/.pi-chains/chains/      — project local
 */
export function discoverChains(extensionDir: string, cwd: string): ChainDef[] {
	const dirs = [
		join(extensionDir, "examples"),
		join(homedir(), ".pi-chains", "chains"),
		join(cwd, ".pi-chains", "chains"),
	];

	const byName = new Map<string, ChainDef>();
	for (const dir of dirs) {
		if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
		for (const entry of readdirSync(dir)) {
			if (!entry.endsWith(".yaml") && !entry.endsWith(".yml")) continue;
			const path = join(dir, entry);
			try {
				const chain = parseChainFile(readFileSync(path, "utf8"), path);
				byName.set(chain.name, chain);
			} catch (err) {
				console.error(`[pi-chains] Failed to parse ${path}: ${(err as Error).message}`);
			}
		}
	}
	return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Minimal YAML parser tailored to the chain schema. Supports:
 *   name: <string>
 *   description: <string>
 *   steps:
 *     - role: <string>
 *       prompt: |
 *         <multiline>
 *       model: <optional string>
 *       provider: <optional string>
 *
 * No anchors, no flow style, no nested maps inside steps beyond the four keys above.
 * Keeping a hand-rolled parser avoids adding js-yaml as a dep at this stage.
 */
export function parseChainFile(raw: string, source: string): ChainDef {
	const lines = raw.split("\n");
	let name = "";
	let description = "";
	const steps: ChainStep[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];
		const stripped = line.replace(/\s+$/, "");
		if (!stripped || stripped.trimStart().startsWith("#")) {
			i++;
			continue;
		}

		const topMatch = stripped.match(/^(name|description|steps):\s*(.*)$/);
		if (topMatch) {
			const key = topMatch[1];
			const rest = topMatch[2];
			if (key === "name") {
				name = unquote(rest.trim());
				i++;
				continue;
			}
			if (key === "description") {
				if (rest.trim() === "|" || rest.trim() === ">") {
					const block = readBlockScalar(lines, i + 1, 0);
					description = block.text;
					i = block.next;
				} else {
					description = unquote(rest.trim());
					i++;
				}
				continue;
			}
			if (key === "steps") {
				const result = parseSteps(lines, i + 1);
				steps.push(...result.steps);
				i = result.next;
				continue;
			}
		}
		i++;
	}

	if (!name) throw new Error("chain missing 'name'");
	if (steps.length === 0) throw new Error("chain has no steps");
	return { name, description, steps, source };
}

function parseSteps(lines: string[], start: number): { steps: ChainStep[]; next: number } {
	const steps: ChainStep[] = [];
	let i = start;
	let current: Partial<ChainStep> | null = null;

	while (i < lines.length) {
		const line = lines[i];
		if (!line.trim() || line.trimStart().startsWith("#")) {
			i++;
			continue;
		}
		// Stop on a top-level key (no leading whitespace and contains ':')
		if (/^\S/.test(line) && line.includes(":")) {
			break;
		}

		const itemMatch = line.match(/^(\s*)-\s+(\w+):\s*(.*)$/);
		if (itemMatch) {
			if (current) steps.push(finalizeStep(current));
			current = {};
			const key = itemMatch[2];
			const rest = itemMatch[3];
			assignField(current, key, rest, lines, i, itemMatch[1].length + 2);
			i = advanceAfterField(lines, i, rest, itemMatch[1].length + 2);
			continue;
		}

		const fieldMatch = line.match(/^(\s+)(\w+):\s*(.*)$/);
		if (fieldMatch && current) {
			const indent = fieldMatch[1].length;
			const key = fieldMatch[2];
			const rest = fieldMatch[3];
			assignField(current, key, rest, lines, i, indent);
			i = advanceAfterField(lines, i, rest, indent);
			continue;
		}
		i++;
	}
	if (current) steps.push(finalizeStep(current));
	return { steps, next: i };
}

function assignField(
	target: Partial<ChainStep>,
	key: string,
	rest: string,
	lines: string[],
	lineIdx: number,
	indent: number,
): void {
	if (rest.trim() === "|" || rest.trim() === ">") {
		const block = readBlockScalar(lines, lineIdx + 1, indent);
		setStepField(target, key, block.text);
		return;
	}
	setStepField(target, key, unquote(rest.trim()));
}

function advanceAfterField(lines: string[], lineIdx: number, rest: string, indent: number): number {
	if (rest.trim() === "|" || rest.trim() === ">") {
		return readBlockScalar(lines, lineIdx + 1, indent).next;
	}
	return lineIdx + 1;
}

function setStepField(target: Partial<ChainStep>, key: string, value: string): void {
	if (key === "role" || key === "prompt" || key === "model" || key === "provider") {
		target[key] = value;
		return;
	}
	if (key === "timeout_sec" || key === "timeoutSec") {
		const n = parseInt(value, 10);
		if (Number.isFinite(n) && n > 0) target.timeoutSec = n;
	}
}

function finalizeStep(s: Partial<ChainStep>): ChainStep {
	if (!s.role) throw new Error("step missing 'role'");
	if (!s.prompt) throw new Error(`step '${s.role}' missing 'prompt'`);
	return { role: s.role, prompt: s.prompt, model: s.model, provider: s.provider, timeoutSec: s.timeoutSec };
}

function readBlockScalar(
	lines: string[],
	start: number,
	parentIndent: number,
): { text: string; next: number } {
	const collected: string[] = [];
	let i = start;
	let blockIndent = -1;
	while (i < lines.length) {
		const line = lines[i];
		if (line.trim() === "") {
			collected.push("");
			i++;
			continue;
		}
		const leading = line.match(/^(\s*)/)![1].length;
		if (leading <= parentIndent) break;
		if (blockIndent === -1) blockIndent = leading;
		collected.push(line.slice(blockIndent));
		i++;
	}
	while (collected.length && collected[collected.length - 1] === "") collected.pop();
	return { text: collected.join("\n"), next: i };
}

function unquote(s: string): string {
	if (
		(s.startsWith('"') && s.endsWith('"')) ||
		(s.startsWith("'") && s.endsWith("'"))
	) {
		return s.slice(1, -1);
	}
	return s;
}

export function resolveExtensionDir(metaUrl: string): string {
	// Resolve from this file's location to the package root (one level up from src/).
	const url = new URL(".", metaUrl);
	return resolve(url.pathname, "..");
}

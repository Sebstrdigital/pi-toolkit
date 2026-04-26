import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { resolveRole } from "./role-resolver.ts";
import { spawnStep } from "./spawner.ts";
import type { ChainDef, ChainResult, StepResult } from "./types.ts";

export interface RunOptions {
	chain: ChainDef;
	originalPrompt: string;
	cwd: string;
	sessionDir: string;
	onStepStart?: (stepIndex: number, role: string) => void;
	onStepEnd?: (stepIndex: number, result: StepResult) => void;
}

/**
 * Run a chain end-to-end. Each step's output becomes $INPUT for the next step's
 * prompt. $ORIGINAL is always the user's original prompt. $STEP[N] (1-indexed)
 * exposes earlier step outputs for non-linear flows.
 */
export async function runChain(opts: RunOptions): Promise<ChainResult> {
	mkdirSync(opts.sessionDir, { recursive: true });

	const chainStart = Date.now();
	const stepResults: StepResult[] = [];
	let lastOutput = "";

	for (let i = 0; i < opts.chain.steps.length; i++) {
		const step = opts.chain.steps[i];
		const role = resolveRole(step.role, opts.cwd);
		const sessionFile = join(opts.sessionDir, `${opts.chain.name}-${i}-${step.role}.jsonl`);
		const prompt = renderPrompt(step.prompt, {
			original: opts.originalPrompt,
			input: lastOutput,
			steps: stepResults,
		});

		opts.onStepStart?.(i, step.role);
		const result = await spawnStep({
			step,
			role,
			prompt,
			sessionFile,
			resumeSession: false,
			cwd: opts.cwd,
			timeoutMs: step.timeoutSec ? step.timeoutSec * 1000 : undefined,
		});
		stepResults.push(result);
		opts.onStepEnd?.(i, result);

		if (result.exitCode !== 0) {
			return {
				chain: opts.chain.name,
				steps: stepResults,
				success: false,
				totalElapsedMs: Date.now() - chainStart,
			};
		}
		lastOutput = result.output;
	}

	return {
		chain: opts.chain.name,
		steps: stepResults,
		success: true,
		totalElapsedMs: Date.now() - chainStart,
	};
}

interface RenderContext {
	original: string;
	input: string;
	steps: StepResult[];
}

export function renderPrompt(template: string, ctx: RenderContext): string {
	let out = template.replace(/\$ORIGINAL\b/g, ctx.original).replace(/\$INPUT\b/g, ctx.input);
	out = out.replace(/\$STEP\[(\d+)\]/g, (_match, n) => {
		const idx = parseInt(n, 10) - 1;
		return ctx.steps[idx]?.output ?? "";
	});
	return out;
}

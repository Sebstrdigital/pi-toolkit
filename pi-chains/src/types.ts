export interface ChainStep {
	role: string;
	prompt: string;
	model?: string;
	provider?: string;
	/** Wall-clock cap for this step in seconds. Spawner SIGKILLs on overrun. */
	timeoutSec?: number;
}

export interface ChainDef {
	name: string;
	description: string;
	steps: ChainStep[];
	source: string;
}

export interface RoleDef {
	name: string;
	skillPath: string;
	allowedTools: string;
}

export interface StepResult {
	role: string;
	output: string;
	exitCode: number;
	elapsedMs: number;
}

export interface ChainResult {
	chain: string;
	steps: StepResult[];
	success: boolean;
	totalElapsedMs: number;
}

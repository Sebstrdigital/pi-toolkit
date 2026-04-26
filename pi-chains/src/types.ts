export interface ChainStep {
	role: string;
	prompt: string;
	model?: string;
	provider?: string;
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

/**
 * Phase 4 spike runner — exercises a chain end-to-end against a target repo.
 *
 * Bypasses the pi TUI (where /chain-run lives) by calling runChain() directly,
 * which is the same code path /chain-run wires to. Goal: get a go/no-go signal
 * on whether the role-specialized chain works end-to-end with pi's currently
 * active model before authoring more chains or polishing UX.
 *
 * Usage:
 *   npx tsx tests/spike.mjs <chain-name> <prompt-file> <target-repo> [--in-place]
 *
 * By default the target repo is cloned into a tmp dir so the chain edits a
 * disposable copy. Pass --in-place to run against the target directly.
 *
 * Outputs land in <repo>/pi-chains/spike-runs/<timestamp>/:
 *   - meta.json          chain config + paths + final verdict
 *   - step-N-<role>.md   per-step prompt and full output
 *   - test-output.txt    `npm test` stdout/stderr after the chain (if applicable)
 */

import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverChains } from "../src/chains-loader.ts";
import { runChain } from "../src/runner.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTENSION_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(EXTENSION_DIR, "..");

function usage() {
	console.error("Usage: npx tsx tests/spike.mjs <chain-name> <prompt-file> <target-repo> [--in-place]");
	process.exit(2);
}

const argv = process.argv.slice(2);
if (argv.length < 3) usage();
const [chainName, promptFile, targetArg, ...flags] = argv;
const inPlace = flags.includes("--in-place");

const prompt = readFileSync(promptFile, "utf8").trim();
const target = resolve(targetArg);

const chains = discoverChains(EXTENSION_DIR, EXTENSION_DIR);
const chain = chains.find((c) => c.name === chainName);
if (!chain) {
	console.error(`Chain '${chainName}' not found. Available: ${chains.map((c) => c.name).join(", ")}`);
	process.exit(2);
}

let workdir = target;
if (!inPlace) {
	const tmp = mkdtempSync(join(tmpdir(), `pi-chains-spike-${chainName}-`));
	workdir = join(tmp, "repo");
	console.log(`[spike] Cloning ${target} -> ${workdir}`);
	execSync(`git clone --quiet "${target}" "${workdir}"`, { stdio: "inherit" });
	if (
		execSync(`ls "${target}" | grep -c ^node_modules\\$ || true`, { encoding: "utf8" }).trim() !== "0"
	) {
		console.log("[spike] Linking node_modules from target into clone");
		execSync(`ln -s "${target}/node_modules" "${workdir}/node_modules"`);
	}
}

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = join(REPO_ROOT, "pi-chains", "spike-runs", `${chainName}-${ts}`);
mkdirSync(runDir, { recursive: true });
const sessionDir = join(runDir, "sessions");

console.log(`[spike] Chain: ${chainName} (${chain.steps.length} steps)`);
console.log(`[spike] Target: ${workdir}`);
console.log(`[spike] Run log: ${runDir}`);
console.log(`[spike] Prompt: ${prompt.slice(0, 120)}${prompt.length > 120 ? "…" : ""}`);
console.log();

const t0 = Date.now();
const result = await runChain({
	chain,
	originalPrompt: prompt,
	cwd: workdir,
	sessionDir,
	onStepStart: (i, role) => {
		const banner = `[${i + 1}/${chain.steps.length}] ${role} starting…`;
		console.log(banner);
	},
	onStepEnd: (i, r) => {
		const status = r.exitCode === 0 ? "done" : `FAILED (exit ${r.exitCode})`;
		console.log(`[${i + 1}/${chain.steps.length}] ${r.role} ${status} in ${(r.elapsedMs / 1000).toFixed(1)}s`);
		const stepFile = join(runDir, `step-${i + 1}-${r.role}.md`);
		writeFileSync(
			stepFile,
			`# Step ${i + 1} — ${r.role}\n\nExit: ${r.exitCode}  Elapsed: ${(r.elapsedMs / 1000).toFixed(1)}s\n\n## Output\n\n${r.output}\n`,
		);
	},
});

const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n[spike] Chain ${result.success ? "complete" : "FAILED"} in ${totalSec}s`);

let testReport = null;
if (result.success) {
	console.log("\n[spike] Running post-chain `npm test` for ground-truth verification…");
	const t = spawnSync("npm", ["test"], { cwd: workdir, encoding: "utf8" });
	const out = (t.stdout ?? "") + "\n" + (t.stderr ?? "");
	writeFileSync(join(runDir, "test-output.txt"), out);
	const passMatch = out.match(/(\d+)\s+passing/i) ?? out.match(/Tests:\s+\d+\s+failed,\s+(\d+)\s+passed/i) ?? out.match(/Tests:\s+(\d+)\s+passed/i);
	const failMatch = out.match(/(\d+)\s+failing/i) ?? out.match(/Tests:\s+(\d+)\s+failed/i);
	testReport = {
		exitCode: t.status,
		passed: passMatch ? parseInt(passMatch[1], 10) : null,
		failed: failMatch ? parseInt(failMatch[1], 10) : null,
	};
	console.log(`[spike] npm test exit=${t.status}  passed=${testReport.passed}  failed=${testReport.failed}`);
}

writeFileSync(
	join(runDir, "meta.json"),
	JSON.stringify(
		{
			chain: chainName,
			target,
			workdir,
			inPlace,
			prompt,
			startedAt: new Date(t0).toISOString(),
			totalSeconds: parseFloat(totalSec),
			success: result.success,
			steps: result.steps.map((s) => ({ role: s.role, exitCode: s.exitCode, elapsedMs: s.elapsedMs })),
			testReport,
		},
		null,
		2,
	),
);

console.log(`\n[spike] Done. Logs at: ${runDir}`);
process.exit(result.success ? 0 : 1);

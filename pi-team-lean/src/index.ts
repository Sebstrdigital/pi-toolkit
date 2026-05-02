import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { runPi } from "./pi.js";
import { qaScriptPrompt, workerPrompt } from "./prompts.js";
import {
  ensureCleanTree,
  cutBranch,
  checkout,
  branchExists,
  mergeNoFf,
  commitsOnBranch,
  currentBranch,
  diffBetween,
} from "./git.js";
import { runPaths, writeArtifact, writeJsonArtifact, ARTIFACTS } from "./runs.js";
import { scenariosForStory } from "./features.js";
import { judgeScenarios } from "./scenarios.js";
import { runReview, reviewerFeedbackForWorker, type ReviewResult } from "./reviewer.js";
import { cliPreflight } from "./preflight.js";
import type { Sprint, SprintState, StoryState, Story } from "./types.js";

const DEFAULT_WORKER_TIMEOUT_MIN = 15;

const log = (msg: string): void => console.log(`[pi-team-lean] ${msg}`);

const topoSort = (stories: Story[]): Story[] => {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const result: Story[] = [];
  const visit = (s: Story, stack: Set<string>): void => {
    if (visited.has(s.id)) return;
    if (stack.has(s.id)) throw new Error(`Cyclic dependency at ${s.id}`);
    stack.add(s.id);
    for (const dep of s.depends_on ?? []) {
      const d = byId.get(dep);
      if (!d) throw new Error(`Story ${s.id} depends on unknown ${dep}`);
      visit(d, stack);
    }
    stack.delete(s.id);
    visited.add(s.id);
    result.push(s);
  };
  for (const s of stories) visit(s, new Set());
  return result;
};

const runTestCommand = (cmd: string, cwd: string): { ok: boolean; output: string } => {
  try {
    const output = execFileSync("sh", ["-c", cmd], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, output };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer | string; stderr?: Buffer | string };
    const out = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "");
    return { ok: false, output: out };
  }
};

const main = async (): Promise<void> => {
  if (process.argv[2] === "check") {
    process.exit(cliPreflight(process.argv.slice(3)));
  }
  const sprintPath = process.argv[2];
  if (!sprintPath) {
    console.error("Usage: pi-team-lean <sprint.json> [--cwd <repo>]");
    console.error("       pi-team-lean check <repo> [--sprint <path>]");
    process.exit(2);
  }
  const cwdFlagIdx = process.argv.indexOf("--cwd");
  const repoCwd = cwdFlagIdx > 0 ? resolve(process.argv[cwdFlagIdx + 1]!) : process.cwd();
  const storyFlagIdx = process.argv.indexOf("--story");
  const onlyStory = storyFlagIdx > 0 ? process.argv[storyFlagIdx + 1] : undefined;

  const sprint: Sprint = JSON.parse(readFileSync(sprintPath, "utf8"));
  if (onlyStory) {
    const filtered = sprint.stories.filter((s) => s.id === onlyStory);
    if (filtered.length === 0) {
      console.error(`[pi-team-lean] --story ${onlyStory} not found in sprint`);
      process.exit(2);
    }
    filtered[0]!.depends_on = [];
    sprint.stories = filtered;
    console.log(`[pi-team-lean] Filtered to single story: ${onlyStory} (dependencies cleared)`);
  }
  const baseBranch = sprint.base_branch ?? "main";
  const runId = sprint.staging_branch ? sprint.staging_branch.split("/").pop()! : `${Date.now()}`;
  const stagingBranch = sprint.staging_branch ?? `pi-team-lean/${runId}/staging`;
  const testCommand = sprint.test_command ?? "npm test";
  const stateDir = join(repoCwd, ".pi-team-lean");
  const acceptDir = join(stateDir, "acceptance");
  const statePath = join(stateDir, "sprint-state.json");
  const paths = runPaths(repoCwd, runId);

  ensureCleanTree(repoCwd);
  mkdirSync(acceptDir, { recursive: true });
  mkdirSync(paths.root, { recursive: true });
  log(`Repo: ${repoCwd}`);
  log(`Base: ${baseBranch}  Staging: ${stagingBranch}`);

  if (!branchExists(stagingBranch, repoCwd)) {
    cutBranch(stagingBranch, baseBranch, repoCwd);
    log(`Cut staging from ${baseBranch}`);
  } else {
    checkout(stagingBranch, repoCwd);
    log(`Resumed staging`);
  }

  const state: SprintState = {
    started_at: new Date().toISOString(),
    base_branch: baseBranch,
    staging_branch: stagingBranch,
    stories: Object.fromEntries(sprint.stories.map((s) => [s.id, { status: "pending" } as StoryState])),
  };
  const persist = (): void => {
    writeFileSync(statePath, JSON.stringify(state, null, 2));
    for (const [sid, ss] of Object.entries(state.stories)) {
      if (ss.status === "pending") continue;
      writeJsonArtifact(paths.artifact(sid, ARTIFACTS.meta), { id: sid, ...ss });
    }
  };
  persist();

  const ordered = topoSort(sprint.stories);

  for (const story of ordered) {
    const ss = state.stories[story.id]!;
    const blockers = (story.depends_on ?? []).filter((d) => state.stories[d]?.status !== "merged");
    if (blockers.length > 0) {
      ss.status = "skipped";
      ss.failure_reason = `blocked by ${blockers.join(", ")}`;
      log(`SKIP  ${story.id}: ${ss.failure_reason}`);
      persist();
      continue;
    }

    ss.status = "in_progress";
    ss.started_at = new Date().toISOString();
    persist();
    log(`---- ${story.id}: ${story.title} ----`);

    paths.storyDir(story.id);
    const acceptPath = join(acceptDir, `${story.id}.sh`);

    // 1. Cut feature branch from staging, run worker (worker does NOT see acceptance criteria)
    const featureBranch = `pi-team-lean/${runId}/story-${story.id}`;
    cutBranch(featureBranch, stagingBranch, repoCwd);
    ss.branch = featureBranch;
    persist();

    const maxIter = sprint.enable_reviewer ? Math.max(1, sprint.max_review_iterations ?? 2) : 1;
    let workerDiff = "";
    let lastReview: ReviewResult | undefined;
    let workerFailed = false;

    for (let iter = 1; iter <= maxIter; iter++) {
      const feedback = lastReview ? reviewerFeedbackForWorker(lastReview) : "";
      const timeoutMin = story.worker_timeout_min ?? sprint.worker_timeout_min ?? DEFAULT_WORKER_TIMEOUT_MIN;
      const timeoutMs = timeoutMin * 60 * 1000;
      log(`worker: implementing on ${featureBranch} (iter ${iter}/${maxIter}${feedback ? ", with review feedback" : ""}, timeout ${timeoutMin}m)`);
      const w = await runPi(
        workerPrompt(story, "", story.test_command ?? testCommand, feedback),
        repoCwd,
        sprint.worker_model,
        (line) => {
          if (line.trim()) console.log(`  pi> ${line}`);
        },
        { timeoutMs },
      );
      writeArtifact(paths.artifact(story.id, `worker.iter${iter}.stdout.log`), w.stdout);
      writeArtifact(paths.artifact(story.id, `worker.iter${iter}.stderr.log`), w.stderr);
      writeArtifact(paths.artifact(story.id, ARTIFACTS.workerStdout), w.stdout);
      writeArtifact(paths.artifact(story.id, ARTIFACTS.workerStderr), w.stderr);

      if (w.exitCode !== 0) {
        ss.status = "failed";
        const reason = w.timedOut ? `worker timed out after ${timeoutMin}m (iter ${iter})` : `worker exit ${w.exitCode} (iter ${iter})`;
        ss.failure_reason = `${reason}\n${w.stderr.slice(0, 500)}`;
        workerFailed = true;
        break;
      }

      const commitsSoFar = commitsOnBranch(featureBranch, stagingBranch, repoCwd);
      if (commitsSoFar.length === 0) {
        ss.status = "failed";
        ss.failure_reason = `worker exited but made no commits (iter ${iter})`;
        workerFailed = true;
        break;
      }
      ss.commits = commitsSoFar;
      workerDiff = diffBetween(stagingBranch, featureBranch, repoCwd);
      writeArtifact(paths.artifact(story.id, ARTIFACTS.workerDiff), workerDiff);
      persist();

      if (!sprint.enable_reviewer) break;

      log(`reviewer: pass ${iter}/${maxIter}`);
      const review = await runReview(story, workerDiff, repoCwd, sprint.reviewer_model, lastReview);
      writeJsonArtifact(paths.artifact(story.id, `reviewer.iter${iter}.json`), review);
      writeJsonArtifact(paths.artifact(story.id, ARTIFACTS.reviewerJudgement), review);
      const mustFix = review.issues.filter((i) => i.severity === "must_fix");
      log(`reviewer: ${review.verdict} (${mustFix.length} must_fix, ${review.issues.length - mustFix.length} nice_to_have)`);
      for (const m of mustFix) log(`        ${m.category} ${m.file}${m.line ? `:${m.line}` : ""} — ${m.problem}`);
      lastReview = review;
      if (review.verdict === "approve") break;
      if (iter === maxIter) {
        log(`WARN  ${story.id}: reviewer still requesting changes after ${maxIter} iterations — proceeding (lenient)`);
        break;
      }
    }

    if (workerFailed) {
      checkout(stagingBranch, repoCwd);
      log(`FAIL  ${story.id}: ${ss.failure_reason}`);
      ss.ended_at = new Date().toISOString();
      persist();
      continue;
    }

    // 4. Run test command
    log(`verify: ${story.test_command ?? testCommand}`);
    const t = runTestCommand(story.test_command ?? testCommand, repoCwd);
    writeArtifact(paths.artifact(story.id, ARTIFACTS.testCommandOutput), t.output);
    if (!t.ok) {
      ss.status = "failed";
      ss.failure_reason = `test_command failed:\n${t.output.slice(-1500)}`;
      checkout(stagingBranch, repoCwd);
      log(`FAIL  ${story.id}: tests`);
      ss.ended_at = new Date().toISOString();
      persist();
      continue;
    }

    // 5. Generate qa-script with diff visibility, then run it
    log(`qa-script: drafting (diff-aware)`);
    const qa = await runPi(qaScriptPrompt(story, workerDiff), repoCwd, sprint.qa_model);
    if (qa.exitCode !== 0 || !qa.stdout.trim()) {
      ss.status = "failed";
      ss.failure_reason = `qa-script author failed (exit ${qa.exitCode})\n${qa.stderr.slice(0, 500)}`;
      checkout(stagingBranch, repoCwd);
      log(`FAIL  ${story.id}: ${ss.failure_reason}`);
      ss.ended_at = new Date().toISOString();
      persist();
      continue;
    }
    writeFileSync(acceptPath, qa.stdout);
    chmodSync(acceptPath, 0o755);
    writeArtifact(paths.artifact(story.id, ARTIFACTS.qaScript), qa.stdout);

    log(`accept: ${acceptPath}`);
    const a = runTestCommand(`bash ${acceptPath}`, repoCwd);
    writeArtifact(paths.artifact(story.id, ARTIFACTS.qaScriptOutput), a.output);
    if (!a.ok) {
      ss.status = "failed";
      ss.failure_reason = `acceptance failed:\n${a.output.slice(-1500)}`;
      checkout(stagingBranch, repoCwd);
      log(`FAIL  ${story.id}: acceptance`);
      ss.ended_at = new Date().toISOString();
      persist();
      continue;
    }

    // 5b. Scenario-judge (lenient: warn but don't block)
    const scenarios = scenariosForStory(sprint.feature_path, story.id, story.feature_story_id);
    if (scenarios.length > 0) {
      log(`judge: ${scenarios.length} scenarios via 3-judge majority`);
      const diff = diffBetween(stagingBranch, featureBranch, repoCwd);
      const judgement = await judgeScenarios(story, scenarios, diff, t.output, repoCwd, sprint.judge_model);
      writeJsonArtifact(paths.artifact(story.id, ARTIFACTS.scenarioJudgement), judgement);
      const failed = judgement.consensus.filter((c) => c.verdict === "fail");
      const inconclusive = judgement.consensus.filter((c) => c.verdict === "inconclusive");
      if (failed.length > 0) {
        log(`WARN  ${story.id}: scenario-judge fail (${failed.length}/${scenarios.length}) — proceeding (lenient)`);
        for (const f of failed) log(`        ${f.id}: ${f.gaps[0] ?? "no gap reported"}`);
      } else if (inconclusive.length > 0) {
        log(`WARN  ${story.id}: scenario-judge inconclusive (${inconclusive.length}/${scenarios.length})`);
      } else {
        log(`PASS  ${story.id}: scenarios pass`);
      }
    } else if (sprint.feature_path) {
      log(`judge: no scenarios found for ${story.id} in ${sprint.feature_path}`);
    }

    // 6. Merge feature → staging
    mergeNoFf(featureBranch, stagingBranch, `merge: ${story.id} ${story.title}`, repoCwd);
    ss.status = "merged";
    ss.ended_at = new Date().toISOString();
    log(`PASS  ${story.id} merged → ${stagingBranch}`);
    persist();
  }

  state.ended_at = new Date().toISOString();
  persist();
  checkout(stagingBranch, repoCwd);

  const summary = Object.entries(state.stories).map(([id, s]) => `  ${s.status.padEnd(10)} ${id}`);
  log(`\nSprint complete on ${stagingBranch}\n${summary.join("\n")}`);
  log(`State: ${statePath}`);
};

main().catch((e: Error) => {
  console.error(`[pi-team-lean] FATAL: ${e.message}`);
  process.exit(1);
});

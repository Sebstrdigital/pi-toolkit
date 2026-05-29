import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { relative, join, resolve } from "node:path";
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
import { createEventWriter } from "./events.js";
import { runWatch } from "./watch.js";
import { scenariosForStory } from "./features.js";
import { judgeScenarios } from "./scenarios.js";
import { runReview, reviewerFeedbackForWorker, type ReviewResult } from "./reviewer.js";
import { cliPreflight } from "./preflight.js";
import type { Sprint, SprintState, StoryState, Story, StoryStatus } from "./types.js";

const DEFAULT_WORKER_TIMEOUT_MIN = 15;
const DEFAULT_QA_TIMEOUT_MIN = 10;

const log = (msg: string): void => console.log(`[pi-team-lean] ${msg}`);

/** Feedback fed back into the next worker attempt when a phase fails (bounded-retry loop). */
const workerCrashFeedback = (reason: string, stderr: string): string => `# Previous attempt did not produce a usable commit

${reason}

\`\`\`
${stderr.slice(-2000)}
\`\`\`

Implement the story, run the tests, and commit your work with \`git add -A && git commit\`.`;

const testFailureFeedback = (output: string): string => `# Test failure feedback

Your previous commit did not pass the project test command. Find the cause and fix it, then commit again.

\`\`\`
${output.slice(-4000)}
\`\`\`

Do not weaken, skip, or delete tests to make them pass. Commit with: \`git add -A && git commit -m "fix: address failing tests"\``;

const acceptanceFailureFeedback = (output: string): string => `# Acceptance failure feedback

The implementation passed unit tests but FAILED the acceptance checks below. The acceptance script encodes the story's intent — make the behaviour satisfy it. Fix and commit again.

\`\`\`
${output.slice(-4000)}
\`\`\`

Do not edit the acceptance script — fix the implementation. Commit with: \`git add -A && git commit -m "fix: satisfy acceptance checks"\``;

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

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'"'"'`)}'`;

const branchRunId = (branch: string): string =>
  branch
    .replace(/^pi-team-lean\//, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "staging";

const readSprintState = (path: string): SprintState | undefined => {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SprintState;
  } catch {
    return undefined;
  }
};

const initialSprintState = (stories: Story[], baseBranch: string, stagingBranch: string): SprintState => ({
  started_at: new Date().toISOString(),
  base_branch: baseBranch,
  staging_branch: stagingBranch,
  stories: Object.fromEntries(stories.map((s) => [s.id, { status: "pending" } as StoryState])),
});

const mergeSprintState = (state: SprintState, stories: Story[]): SprintState => ({
  ...state,
  stories: {
    ...Object.fromEntries(stories.map((s) => [s.id, { status: "pending" } as StoryState])),
    ...state.stories,
  },
});

const openTmuxWatcher = (repoCwd: string, runId: string): void => {
  if (!process.env.TMUX) {
    log("WARN  --tmux-ui requested but this process is not inside tmux; run `pi-team-lean tui --cwd ... --run ...` manually");
    return;
  }
  const command = `pi-team-lean watch --cwd ${shellQuote(repoCwd)} --run ${shellQuote(runId)}`;
  try {
    execFileSync("tmux", ["split-window", "-h", "-c", repoCwd, command], {
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "utf8",
    });
    log(`Opened right-side tmux watcher pane for run ${runId}`);
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer | string; message?: string };
    const detail = err.stderr?.toString() ?? err.message ?? "unknown error";
    log(`WARN  failed to open tmux watcher pane: ${detail.trim()}`);
  }
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

const resolveStoryCwd = (repoCwd: string, story: Story): string => {
  const storyCwd = resolve(repoCwd, story.repo_path ?? ".");
  const rel = relative(repoCwd, storyCwd);
  if (rel.startsWith("..") || resolve(rel) === rel) {
    throw new Error(`Story ${story.id} repo_path escapes --cwd: ${story.repo_path}`);
  }
  return storyCwd;
};

const ensureStagingBranch = (
  stagingBranch: string,
  storyBaseBranch: string,
  cwd: string,
  events: ReturnType<typeof createEventWriter>,
): void => {
  if (!branchExists(stagingBranch, cwd)) {
    cutBranch(stagingBranch, storyBaseBranch, cwd);
    events.emit({ type: "git", action: "cut_branch", branch: stagingBranch, fromBranch: storyBaseBranch });
    log(`Cut staging from ${storyBaseBranch} in ${cwd}`);
  } else {
    checkout(stagingBranch, cwd);
    events.emit({ type: "git", action: "checkout", branch: stagingBranch });
    log(`Resumed staging in ${cwd}`);
  }
};

/**
 * Per-run state shared across all stories in a sprint. Built once by runSprint
 * and threaded into each runStory call so a story can run standalone (board /
 * daemon callers) without re-deriving the whole setup.
 */
export interface RunContext {
  sprint: Sprint;
  repoCwd: string;
  baseBranch: string;
  stagingBranch: string;
  runId: string;
  testCommand: string;
  acceptDir: string;
  paths: ReturnType<typeof runPaths>;
  events: ReturnType<typeof createEventWriter>;
  state: SprintState;
  persist: () => void;
  emitArtifact: (storyId: string, name: string, path: string) => void;
}

/**
 * Run a single story end-to-end on its own feature branch: worker (+ optional
 * reviewer loop) → verify → qa-script → acceptance → scenario-judge → merge.
 * Mutates ctx.state for this story and persists; returns when the story reaches
 * a terminal state (merged / failed / skipped). Does not throw on story failure.
 */
export const runStory = async (story: Story, ctx: RunContext): Promise<void> => {
  const { sprint, baseBranch, stagingBranch, runId, testCommand, acceptDir, paths, events, state, persist, emitArtifact } = ctx;
  const ss = state.stories[story.id]!;
  const blockers = (story.depends_on ?? []).filter((d) => state.stories[d]?.status !== "merged");
  if (blockers.length > 0) {
    ss.status = "skipped";
    ss.failure_reason = `blocked by ${blockers.join(", ")}`;
    log(`SKIP  ${story.id}: ${ss.failure_reason}`);
    events.emit({ type: "story_skipped", storyId: story.id, reason: ss.failure_reason });
    persist();
    return;
  }

  ss.status = "in_progress";
  ss.started_at = new Date().toISOString();
  ss.repo_path = story.repo_path ?? ".";
  persist();
  log(`---- ${story.id}: ${story.title} ----`);
  events.emit({ type: "story_started", storyId: story.id, title: story.title });

  paths.storyDir(story.id);
  const acceptPath = join(acceptDir, `${story.id}.sh`);
  const storyCwd = resolveStoryCwd(ctx.repoCwd, story);
  const storyBaseBranch = story.base_branch ?? baseBranch;
  ensureStagingBranch(stagingBranch, storyBaseBranch, storyCwd, events);

  // 1. Cut feature branch from staging, run worker (worker does NOT see acceptance criteria)
  const featureBranch = `pi-team-lean/${runId}/story-${story.id}`;
  events.emit({ type: "phase_started", storyId: story.id, phase: "staging", detail: `cut ${featureBranch}` });
  cutBranch(featureBranch, stagingBranch, storyCwd);
  events.emit({ type: "git", action: "cut_branch", branch: featureBranch, fromBranch: stagingBranch });
  events.emit({ type: "phase_finished", storyId: story.id, phase: "staging", ok: true, detail: featureBranch });
  ss.branch = featureBranch;
  persist();

  const maxIter = Math.max(1, sprint.max_iterations ?? sprint.max_review_iterations ?? 3);
  const retry = {
    worker: sprint.retry_on?.worker ?? true,
    reviewer: sprint.retry_on?.reviewer ?? true,
    test: sprint.retry_on?.test ?? true,
    acceptance: sprint.retry_on?.acceptance ?? true,
  };

  /** Terminal exit for a story: restore staging, record status, emit, persist. */
  const endStory = (status: StoryStatus, reason: string): void => {
    ss.status = status;
    ss.failure_reason = reason;
    checkout(stagingBranch, storyCwd);
    events.emit({ type: "git", action: "checkout", branch: stagingBranch });
    log(`${status === "needs_human" ? "PARK" : "FAIL"}  ${story.id}: ${reason.split("\n")[0]}`);
    ss.ended_at = new Date().toISOString();
    events.emit({ type: "story_finished", storyId: story.id, status, failureReason: reason });
    persist();
  };
  const noteRetry = (phase: string, iter: number): void => {
    log(`retry ${story.id}: ${phase} failed — attempt ${iter + 1}/${maxIter}`);
    events.emit({ type: "log", message: `retry ${story.id}: ${phase} failed, attempt ${iter + 1}/${maxIter}` });
  };

  let workerDiff = "";
  let lastReview: ReviewResult | undefined;
  let feedback = "";

  // Bounded delivery loop: worker → reviewer → verify → acceptance. Any phase
  // failure (with budget + retry enabled) feeds typed feedback back to the next
  // worker attempt; on cap-exceed the story parks as needs_human (never a silent
  // merge). A phase whose retry toggle is off fails hard instead of parking.
  for (let iter = 1; iter <= maxIter; iter++) {
    ss.iterations = iter;
    persist();

    // 1. Worker implements (sees accumulated feedback from any prior failed phase)
    const timeoutMin = story.worker_timeout_min ?? sprint.worker_timeout_min ?? DEFAULT_WORKER_TIMEOUT_MIN;
    const timeoutMs = timeoutMin * 60 * 1000;
    log(`worker: implementing on ${featureBranch} (iter ${iter}/${maxIter}${feedback ? ", with feedback" : ""}, timeout ${timeoutMin}m)`);
    events.emit({
      type: "phase_started",
      storyId: story.id,
      phase: "worker",
      iteration: iter,
      totalIterations: maxIter,
      detail: `${featureBranch}, timeout ${timeoutMin}m`,
    });
    const w = await runPi(
      workerPrompt(story, "", story.test_command ?? testCommand, feedback),
      storyCwd,
      sprint.worker_model,
      (line) => {
        if (line.trim()) {
          console.log(`  pi> ${line}`);
          events.emit({ type: "pi_stdout", storyId: story.id, phase: "worker", line, iteration: iter });
        }
      },
      { timeoutMs },
      (line) => {
        if (line.trim()) events.emit({ type: "pi_stderr", storyId: story.id, phase: "worker", line, iteration: iter });
      },
    );
    const workerIterStdout = paths.artifact(story.id, `worker.iter${iter}.stdout.log`);
    const workerIterStderr = paths.artifact(story.id, `worker.iter${iter}.stderr.log`);
    const workerStdout = paths.artifact(story.id, ARTIFACTS.workerStdout);
    const workerStderr = paths.artifact(story.id, ARTIFACTS.workerStderr);
    writeArtifact(workerIterStdout, w.stdout);
    emitArtifact(story.id, `worker.iter${iter}.stdout.log`, workerIterStdout);
    writeArtifact(workerIterStderr, w.stderr);
    emitArtifact(story.id, `worker.iter${iter}.stderr.log`, workerIterStderr);
    writeArtifact(workerStdout, w.stdout);
    emitArtifact(story.id, ARTIFACTS.workerStdout, workerStdout);
    writeArtifact(workerStderr, w.stderr);
    emitArtifact(story.id, ARTIFACTS.workerStderr, workerStderr);

    if (w.exitCode !== 0) {
      const reason = w.timedOut ? `worker timed out after ${timeoutMin}m (iter ${iter})` : `worker exit ${w.exitCode} (iter ${iter})`;
      events.emit({ type: "phase_finished", storyId: story.id, phase: "worker", ok: false, detail: reason, iteration: iter });
      if (retry.worker && iter < maxIter) {
        feedback = workerCrashFeedback(reason, w.stderr);
        noteRetry("worker", iter);
        continue;
      }
      return endStory(retry.worker ? "needs_human" : "failed", `${reason}\n${w.stderr.slice(0, 500)}`);
    }

    const commitsSoFar = commitsOnBranch(featureBranch, stagingBranch, storyCwd);
    if (commitsSoFar.length === 0) {
      const reason = `worker exited but made no commits (iter ${iter})`;
      events.emit({ type: "phase_finished", storyId: story.id, phase: "worker", ok: false, detail: reason, iteration: iter });
      if (retry.worker && iter < maxIter) {
        feedback = workerCrashFeedback(reason, w.stderr);
        noteRetry("worker", iter);
        continue;
      }
      return endStory(retry.worker ? "needs_human" : "failed", reason);
    }
    ss.commits = commitsSoFar;
    workerDiff = diffBetween(stagingBranch, featureBranch, storyCwd);
    const workerDiffPath = paths.artifact(story.id, ARTIFACTS.workerDiff);
    writeArtifact(workerDiffPath, workerDiff);
    emitArtifact(story.id, ARTIFACTS.workerDiff, workerDiffPath);
    events.emit({ type: "phase_finished", storyId: story.id, phase: "worker", ok: true, detail: `${commitsSoFar.length} commit(s)`, iteration: iter });
    persist();

    // 2. Reviewer gate (optional). On request_changes: feed back and retry, else park/fail.
    if (sprint.enable_reviewer) {
      log(`reviewer: pass ${iter}/${maxIter}`);
      events.emit({ type: "phase_started", storyId: story.id, phase: "reviewer", iteration: iter, totalIterations: maxIter });
      const review = await runReview(story, workerDiff, storyCwd, sprint.reviewer_model, lastReview);
      const reviewerIterPath = paths.artifact(story.id, `reviewer.iter${iter}.json`);
      const reviewerJudgementPath = paths.artifact(story.id, ARTIFACTS.reviewerJudgement);
      writeJsonArtifact(reviewerIterPath, review);
      emitArtifact(story.id, `reviewer.iter${iter}.json`, reviewerIterPath);
      writeJsonArtifact(reviewerJudgementPath, review);
      emitArtifact(story.id, ARTIFACTS.reviewerJudgement, reviewerJudgementPath);
      const mustFix = review.issues.filter((i) => i.severity === "must_fix");
      log(`reviewer: ${review.verdict} (${mustFix.length} must_fix, ${review.issues.length - mustFix.length} nice_to_have)`);
      events.emit({
        type: "phase_finished",
        storyId: story.id,
        phase: "reviewer",
        ok: review.verdict === "approve",
        detail: `${review.verdict} (${mustFix.length} must_fix)`,
        iteration: iter,
      });
      for (const m of mustFix) log(`        ${m.category} ${m.file}${m.line ? `:${m.line}` : ""} — ${m.problem}`);
      lastReview = review;
      if (review.verdict !== "approve") {
        if (retry.reviewer && iter < maxIter) {
          feedback = reviewerFeedbackForWorker(review);
          noteRetry("reviewer", iter);
          continue;
        }
        return endStory(
          retry.reviewer ? "needs_human" : "failed",
          `reviewer still requesting changes after ${iter} iteration(s); ${mustFix.length} must_fix unresolved`,
        );
      }
    }

    // 3. Verify (test command)
    log(`verify: ${story.test_command ?? testCommand}`);
    events.emit({ type: "phase_started", storyId: story.id, phase: "verify", detail: story.test_command ?? testCommand });
    const t = runTestCommand(story.test_command ?? testCommand, storyCwd);
    const testOutputPath = paths.artifact(story.id, ARTIFACTS.testCommandOutput);
    writeArtifact(testOutputPath, t.output);
    emitArtifact(story.id, ARTIFACTS.testCommandOutput, testOutputPath);
    events.emit({ type: "test_output", storyId: story.id, phase: "verify", ok: t.ok, tail: t.output.split("\n").slice(-80).join("\n") });
    events.emit({ type: "phase_finished", storyId: story.id, phase: "verify", ok: t.ok, detail: t.ok ? "tests passed" : "tests failed" });
    if (!t.ok) {
      if (retry.test && iter < maxIter) {
        feedback = testFailureFeedback(t.output);
        noteRetry("verify", iter);
        continue;
      }
      return endStory(retry.test ? "needs_human" : "failed", `test_command failed after ${iter} iteration(s):\n${t.output.slice(-1500)}`);
    }

    // 4. Generate qa-script with diff visibility, then run it
    log(`qa-script: drafting (diff-aware)`);
    events.emit({ type: "phase_started", storyId: story.id, phase: "qa-script", detail: "drafting acceptance script" });
    const qa = await runPi(
      qaScriptPrompt(story, workerDiff),
      storyCwd,
      sprint.qa_model,
      (line) => {
        if (line.trim()) events.emit({ type: "pi_stdout", storyId: story.id, phase: "qa-script", line });
      },
      { timeoutMs: DEFAULT_QA_TIMEOUT_MIN * 60 * 1000 },
      (line) => {
        if (line.trim()) events.emit({ type: "pi_stderr", storyId: story.id, phase: "qa-script", line });
      },
    );
    if (qa.exitCode !== 0 || !qa.stdout.trim()) {
      const reason = qa.timedOut
        ? `qa-script author timed out after ${DEFAULT_QA_TIMEOUT_MIN}m`
        : `qa-script author failed (exit ${qa.exitCode})\n${qa.stderr.slice(0, 500)}`;
      events.emit({ type: "phase_finished", storyId: story.id, phase: "qa-script", ok: false, detail: reason });
      // qa-author is harness infrastructure, not the worker's code — fail hard, don't park.
      return endStory("failed", reason);
    }
    writeFileSync(acceptPath, qa.stdout);
    chmodSync(acceptPath, 0o755);
    const qaScriptPath = paths.artifact(story.id, ARTIFACTS.qaScript);
    writeArtifact(qaScriptPath, qa.stdout);
    emitArtifact(story.id, ARTIFACTS.qaScript, qaScriptPath);
    events.emit({ type: "phase_finished", storyId: story.id, phase: "qa-script", ok: true, detail: acceptPath });

    log(`accept: ${acceptPath}`);
    events.emit({ type: "phase_started", storyId: story.id, phase: "acceptance", detail: acceptPath });
    const a = runTestCommand(`bash ${acceptPath}`, storyCwd);
    const qaOutputPath = paths.artifact(story.id, ARTIFACTS.qaScriptOutput);
    writeArtifact(qaOutputPath, a.output);
    emitArtifact(story.id, ARTIFACTS.qaScriptOutput, qaOutputPath);
    events.emit({ type: "test_output", storyId: story.id, phase: "acceptance", ok: a.ok, tail: a.output.split("\n").slice(-80).join("\n") });
    events.emit({ type: "phase_finished", storyId: story.id, phase: "acceptance", ok: a.ok, detail: a.ok ? "acceptance passed" : "acceptance failed" });
    if (!a.ok) {
      if (retry.acceptance && iter < maxIter) {
        feedback = acceptanceFailureFeedback(a.output);
        noteRetry("acceptance", iter);
        continue;
      }
      return endStory(retry.acceptance ? "needs_human" : "failed", `acceptance failed after ${iter} iteration(s):\n${a.output.slice(-1500)}`);
    }

    // 5. Scenario-judge (lenient: warn but don't block)
    const scenarios = scenariosForStory(sprint.feature_path, story.id, story.feature_story_id);
    if (scenarios.length > 0) {
      log(`judge: ${scenarios.length} scenarios via 3-judge majority`);
      events.emit({ type: "phase_started", storyId: story.id, phase: "scenario-judge", detail: `${scenarios.length} scenarios` });
      const diff = diffBetween(stagingBranch, featureBranch, storyCwd);
      const judgement = await judgeScenarios(story, scenarios, diff, t.output, storyCwd, sprint.judge_model);
      const scenarioJudgementPath = paths.artifact(story.id, ARTIFACTS.scenarioJudgement);
      writeJsonArtifact(scenarioJudgementPath, judgement);
      emitArtifact(story.id, ARTIFACTS.scenarioJudgement, scenarioJudgementPath);
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
      events.emit({ type: "phase_finished", storyId: story.id, phase: "scenario-judge", ok: judgement.overall !== "fail", detail: judgement.overall });
    } else if (sprint.feature_path) {
      log(`judge: no scenarios found for ${story.id} in ${sprint.feature_path}`);
    }

    // 6. Merge feature → staging — story is green and reviewed
    events.emit({ type: "phase_started", storyId: story.id, phase: "merge", detail: `${featureBranch} → ${stagingBranch}` });
    mergeNoFf(featureBranch, stagingBranch, `merge: ${story.id} ${story.title}`, storyCwd);
    events.emit({ type: "git", action: "merge", fromBranch: featureBranch, intoBranch: stagingBranch, message: `merge: ${story.id} ${story.title}` });
    events.emit({ type: "phase_finished", storyId: story.id, phase: "merge", ok: true, detail: stagingBranch });
    ss.status = "merged";
    ss.ended_at = new Date().toISOString();
    log(`PASS  ${story.id} merged → ${stagingBranch} (iter ${iter}/${maxIter})`);
    events.emit({ type: "story_finished", storyId: story.id, status: ss.status });
    persist();
    return;
  }
};

export interface RunSprintOptions {
  repoCwd: string;
  /** When set, this run is scoped to a single story (its deps already cleared by the caller). */
  onlyStory?: string;
  /** Full story universe for state init. Defaults to sprint.stories; pass the unfiltered list for --story runs. */
  allStories?: Story[];
  tmuxUi?: boolean;
  /** Original sprint file path, recorded in the run_started event. Optional for board/daemon callers. */
  sprintPath?: string;
}

/**
 * Run a whole sprint: derive per-run context, init/resume state, then run each
 * story (in dependency order) via runStory, and tear down. Returns the final
 * SprintState. Pure callable — does not read argv or call process.exit — so the
 * board watcher and daemon can drive it directly.
 */
export const runSprint = async (sprint: Sprint, opts: RunSprintOptions): Promise<SprintState> => {
  const { repoCwd, onlyStory, tmuxUi = false } = opts;
  const baseBranch = sprint.base_branch ?? "main";
  const runId = sprint.staging_branch ? branchRunId(sprint.staging_branch) : `${Date.now()}`;
  const stagingBranch = sprint.staging_branch ?? `pi-team-lean/${runId}/staging`;
  const testCommand = sprint.test_command ?? "npm test";
  const stateDir = join(repoCwd, ".pi-team-lean");
  const acceptDir = join(stateDir, "acceptance");
  const legacyStatePath = join(stateDir, "sprint-state.json");
  const paths = runPaths(repoCwd, runId);
  const statePath = paths.state;
  const events = createEventWriter(paths.events);
  const emitArtifact = (storyId: string, name: string, path: string): void =>
    events.emit({ type: "artifact_written", storyId, name, path });

  const storyCwds = Array.from(new Set(sprint.stories.map((story) => resolveStoryCwd(repoCwd, story))));
  if (storyCwds.includes(repoCwd)) ensureCleanTree(repoCwd);
  for (const storyCwd of storyCwds) {
    if (storyCwd !== repoCwd) ensureCleanTree(storyCwd);
  }
  mkdirSync(acceptDir, { recursive: true });
  mkdirSync(paths.root, { recursive: true });
  events.emit({
    type: "run_started",
    runId,
    cwd: repoCwd,
    sprintPath: opts.sprintPath ? resolve(opts.sprintPath) : "",
    baseBranch,
    stagingBranch,
    storyCount: sprint.stories.length,
  });
  log(`Repo: ${repoCwd}`);
  events.emit({ type: "log", message: `Repo: ${repoCwd}` });
  log(`Base: ${baseBranch}  Staging: ${stagingBranch}`);
  events.emit({ type: "log", message: `Base: ${baseBranch}  Staging: ${stagingBranch}` });

  const stateUniverse = opts.allStories ?? sprint.stories;
  const state: SprintState = mergeSprintState(
    readSprintState(statePath) ?? readSprintState(legacyStatePath) ?? initialSprintState(stateUniverse, baseBranch, stagingBranch),
    stateUniverse,
  );
  const persist = (): void => {
    writeFileSync(statePath, JSON.stringify(state, null, 2));
    writeFileSync(legacyStatePath, JSON.stringify(state, null, 2));
    events.emit({ type: "state_written", path: statePath });
    for (const [sid, ss] of Object.entries(state.stories)) {
      if (ss.status === "pending") continue;
      writeJsonArtifact(paths.artifact(sid, ARTIFACTS.meta), { id: sid, ...ss });
    }
  };
  persist();
  if (tmuxUi) openTmuxWatcher(repoCwd, runId);

  const ctx: RunContext = {
    sprint,
    repoCwd,
    baseBranch,
    stagingBranch,
    runId,
    testCommand,
    acceptDir,
    paths,
    events,
    state,
    persist,
    emitArtifact,
  };

  const ordered = topoSort(sprint.stories);
  for (const story of ordered) {
    await runStory(story, ctx);
  }

  state.ended_at = new Date().toISOString();
  persist();
  for (const storyCwd of storyCwds) {
    if (branchExists(stagingBranch, storyCwd)) {
      checkout(stagingBranch, storyCwd);
      events.emit({ type: "git", action: "checkout", branch: stagingBranch });
    }
  }

  const summary = Object.entries(state.stories).map(([id, s]) => `  ${s.status.padEnd(10)} ${id}`);
  events.emit({
    type: "run_finished",
    runId,
    stagingBranch,
    summary: Object.entries(state.stories).map(([id, s]) => ({ id, status: s.status })),
  });
  log(`\nSprint complete on ${stagingBranch}\n${summary.join("\n")}`);
  log(`State: ${statePath}`);
  events.emit({ type: "log", message: `State: ${statePath}` });
  return state;
};

const main = async (): Promise<void> => {
  if (process.argv[2] === "check") {
    process.exit(cliPreflight(process.argv.slice(3)));
  }
  if (process.argv[2] === "watch" || process.argv[2] === "tui") {
    const code = runWatch(process.argv.slice(3));
    if (code !== 0) process.exit(code);
    return;
  }
  const sprintPath = process.argv[2];
  if (!sprintPath) {
    console.error("Usage: pi-team-lean <sprint.json> [--cwd <repo>]");
    console.error("       pi-team-lean check <repo> [--sprint <path>]");
    console.error("       pi-team-lean <sprint.json> [--cwd <repo>] [--tmux-ui]");
    console.error("       pi-team-lean tui|watch [--cwd <repo>] [--run <runId>]");
    process.exit(2);
  }
  const cwdFlagIdx = process.argv.indexOf("--cwd");
  const repoCwd = cwdFlagIdx > 0 ? resolve(process.argv[cwdFlagIdx + 1]!) : process.cwd();
  const storyFlagIdx = process.argv.indexOf("--story");
  const onlyStory = storyFlagIdx > 0 ? process.argv[storyFlagIdx + 1] : undefined;
  const explicitTmuxUi = process.argv.includes("--tmux-ui");
  const envTmuxUi = process.env.PI_TEAM_LEAN_TMUX_UI === "1";
  const tmuxUi = explicitTmuxUi || (envTmuxUi && !onlyStory);

  const sprint: Sprint = JSON.parse(readFileSync(sprintPath, "utf8"));
  const allSprintStories = [...sprint.stories];
  if (onlyStory) {
    const filtered = sprint.stories.filter((s) => s.id === onlyStory);
    if (filtered.length === 0) {
      console.error(`[pi-team-lean] --story ${onlyStory} not found in sprint`);
      process.exit(2);
    }
    sprint.stories = [{ ...filtered[0]!, depends_on: [] }];
    console.log(`[pi-team-lean] Filtered to single story: ${onlyStory} (dependencies cleared)`);
  }
  if (envTmuxUi && onlyStory && !explicitTmuxUi) {
    log("Skipping auto tmux watcher for --story run; existing sprint dashboard should keep showing the full run");
  }

  await runSprint(sprint, {
    repoCwd,
    onlyStory,
    allStories: onlyStory ? allSprintStories : undefined,
    tmuxUi,
    sprintPath,
  });
};

main().catch((e: Error) => {
  console.error(`[pi-team-lean] FATAL: ${e.message}`);
  process.exit(1);
});

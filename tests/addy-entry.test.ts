import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const entry = join(root, "scripts/addy-start.mjs");
async function hostPath() {
  const found = spawnSync("sh", ["-c", "command -v pi"], { encoding: "utf8" });
  assert.equal(found.status, 0, "Actual installed Pi loader required");
  let path = dirname(await realpath(found.stdout.trim()));
  for (;;) {
    try { if (JSON.parse(await readFile(join(path, "package.json"), "utf8")).name === "@earendil-works/pi-coding-agent") return path; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const parent = dirname(path); assert.notEqual(parent, path); path = parent;
  }
}
async function fixture(t: any) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "addy-entry-")));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const project = join(dir, "project"), agent = join(dir, "agent"), host = join(dir, "host"), bin = join(host, "bin");
  await mkdir(project); await mkdir(agent); await mkdir(bin, { recursive: true });
  await writeFile(join(host, "package.json"), JSON.stringify({ name: "@earendil-works/pi-coding-agent", version: "loader-fixture" }));
  // Real resource/context/skill loader, fake executable. No extension factory or provider.
  await symlink(join(await hostPath(), "dist"), join(host, "dist"));
  await writeFile(join(bin, "pi"), "#!/bin/sh\nprintf '%s\\0' \"$@\" > \"$LAUNCH_ARGS\"\npwd > \"$LAUNCH_CWD\"\nexit \"${LAUNCH_EXIT:-0}\"\n", { mode: 0o755 });
  // Shield the fixture from parent context files, while testing real discovery/precedence.
  await writeFile(join(dir, "AGENTS.override.md"), "Fixture parent: preserve safety.\n");
  await writeFile(join(agent, "AGENTS.md"), "Global fixture: never publish without authority.\n");
  await writeFile(join(project, "AGENTS.md"), "Project rules: test before edits.\n");
  const env = { ...process.env, PI_CODING_AGENT_DIR: agent, PATH: `${bin}:${process.env.PATH}`,
    LAUNCH_ARGS: join(dir, "launch-args"), LAUNCH_CWD: join(dir, "launch-cwd") };
  const run = (...args: string[]) => spawnSync(process.execPath, [entry, "--project", project, ...args], { env, encoding: "utf8" });
  return { dir, project, agent, env, run };
}

test("check uses actual context selection, reports fresh baseline and starts no session", async t => {
  const f = await fixture(t);
  const run = f.run(); assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.equal(report.project, await realpath(f.project));
  assert.deepEqual(report.blockers, []);
  assert.equal(report.baseline.head, null);
  assert.equal(report.baseline.git, false);
  assert.ok(report.context.some((file: any) => file.path === join(f.agent, "AGENTS.md")));
  assert.ok(report.context.some((file: any) => file.path === join(f.project, "AGENTS.md")));
  await assert.rejects(readFile(f.env.LAUNCH_ARGS), /ENOENT/);
  assert.match(report.limitations, /not.*semantic|not.*compliance/i);
});

test("relative agent config resolves against the intended child project, not the entry caller", async t => {
  const f = await fixture(t);
  const agent = join(f.project, "relative-agent"); await mkdir(agent);
  await writeFile(join(agent, "AGENTS.md"), "context-mode tools are mandatory\n");
  const run = spawnSync(process.execPath, [entry, "--project", f.project, "--launch"], { cwd: f.dir,
    env: { ...f.env, PI_CODING_AGENT_DIR: "relative-agent" }, encoding: "utf8" });
  assert.equal(run.status, 2, run.stderr);
  assert.ok(run.stderr.includes(join(agent, "AGENTS.md")));
  await assert.rejects(readFile(f.env.LAUNCH_ARGS), /ENOENT/);
});

test("relative PATH executable is pinned before switching to the child project cwd", async t => {
  const f = await fixture(t);
  const run = spawnSync(process.execPath, [entry, "--project", f.project, "--launch"], { cwd: f.dir,
    env: { ...f.env, PATH: `host/bin:${process.env.PATH}` }, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.equal((await readFile(f.env.LAUNCH_CWD, "utf8")).trim(), f.project);
  assert.ok(run.stderr.includes(join(f.dir, "host/bin/pi")));
});

test("legacy CLAUDE mandate blocks launch before any session/model executes", async t => {
  const f = await fixture(t);
  await rm(join(f.project, "AGENTS.md"));
  await writeFile(join(f.project, "CLAUDE.md"), "# context-mode — MANDATORY routing rules\n**Use takt for non-trivial work.**\n3. **Wait** — Get explicit approval before touching any code\n");
  const checked = f.run(); assert.equal(checked.status, 2, checked.stderr);
  const report = JSON.parse(checked.stdout); assert.equal(report.blockers.length, 3);
  assert.ok(report.blockers.every((b: any) => b.path === join(f.project, "CLAUDE.md") && b.line > 0));
  assert.equal(f.run("--launch", "--task", "Authorized fixture task").status, 2);
  await assert.rejects(readFile(f.env.LAUNCH_ARGS), /ENOENT/);
});

test("approved project override replaces CLAUDE while global constraints remain", async t => {
  const f = await fixture(t);
  await writeFile(join(f.project, "CLAUDE.md"), "# context-mode — MANDATORY routing rules\n");
  await writeFile(join(f.project, "AGENTS.override.md"), "For explicitly opted-in Addy tasks, native codemode is permitted.\ncontext-mode tools are not required.\ntakt is not required.\nNo separate repeated approval ceremony. Otherwise read CLAUDE.md.\nProject tests remain mandatory.\n");
  const checked = f.run(); assert.equal(checked.status, 0, checked.stderr);
  const report = JSON.parse(checked.stdout);
  assert.ok(report.context.some((file: any) => file.path.endsWith("/project/AGENTS.override.md")));
  assert.ok(!report.context.some((file: any) => file.path === join(f.project, "CLAUDE.md")));
  await writeFile(join(f.agent, "AGENTS.md"), "# context-mode — MANDATORY routing rules\n");
  assert.equal(f.run("--launch").status, 2, "Project override cannot suppress global constraints");
  await assert.rejects(readFile(f.env.LAUNCH_ARGS), /ENOENT/);
});

test("global prompt mandates also block; project override cannot hide them", async t => {
  const f = await fixture(t);
  await writeFile(join(f.agent, "APPEND_SYSTEM.md"), "context-mode tools are required\n");
  const checked = f.run(); assert.equal(checked.status, 2, checked.stderr);
  const report = JSON.parse(checked.stdout);
  assert.ok(report.blockers.some((b: any) => b.path === join(f.agent, "APPEND_SYSTEM.md")));
  assert.equal(f.run("--launch").status, 2);
  await assert.rejects(readFile(f.env.LAUNCH_ARGS), /ENOENT/);
});

test("trusted project settings/prompts require inspection instead of silently bypassing them", async t => {
  const f = await fixture(t);
  await mkdir(join(f.project, ".pi"));
  await writeFile(join(f.project, ".pi/settings.json"), '{"packages":["unapproved-executable"]}');
  const checked = f.run(); assert.equal(checked.status, 2);
  assert.match(JSON.stringify(JSON.parse(checked.stdout).blockers), /settings.json/);
  assert.equal(f.run("--launch").status, 2);
  await assert.rejects(readFile(f.env.LAUNCH_ARGS), /ENOENT/);
});

test("protected project system prompts are not loaded or overridden to force launch", async t => {
  const f = await fixture(t);
  await mkdir(join(f.project, ".pi"));
  await writeFile(join(f.project, ".pi/SYSTEM.md"), "Project safety requirements\n");
  const checked = f.run(); assert.equal(checked.status, 2);
  assert.ok(JSON.parse(checked.stdout).blockers.some((b: any) => b.path.endsWith(".pi/SYSTEM.md")));
  await assert.rejects(readFile(f.env.LAUNCH_ARGS), /ENOENT/);
});

test("fresh dirty Git state is observed, not compared against a stale task snapshot", async t => {
  const f = await fixture(t);
  assert.equal(spawnSync("git", ["init", "-q", f.project]).status, 0);
  await writeFile(join(f.project, "new.txt"), "New task input\n");
  const first = f.run(); assert.equal(first.status, 0, first.stderr);
  const before = JSON.parse(first.stdout); assert.equal(before.baseline.git, true); assert.equal(before.baseline.head, null);
  assert.equal(spawnSync("git", ["-C", f.project, "add", "new.txt"]).status, 0);
  const second = f.run(); assert.equal(second.status, 0, second.stderr);
  const after = JSON.parse(second.stdout); assert.notEqual(before.baseline.statusSha256, after.baseline.statusSha256);
  assert.equal(await readFile(join(f.project, "new.txt"), "utf8"), "New task input\n");
});

test("launch pins one explicit candidate resource set, forwards task literally and child exit", async t => {
  const f = await fixture(t);
  const task = 'Authorized fixture task; $(touch SHOULD_NOT_EXIST) "quotes"';
  const run = f.run("--launch", "--task", task); assert.equal(run.status, 0, run.stderr);
  const args = (await readFile(f.env.LAUNCH_ARGS, "utf8")).split("\0").slice(0, -1);
  for (const flag of ["--no-extensions", "--no-mcp", "--no-skills", "--no-prompt-templates"]) assert.ok(args.includes(flag));
  assert.deepEqual(args.filter((_, i) => args[i - 1] === "--extension"), ["builtin:codemode", join(root, "extensions/delivery-tmux/index.ts")]);
  assert.equal(args[args.indexOf("--skill") + 1], join(root, "skills/addy-engineering/SKILL.md"));
  assert.ok(args.some(arg => arg.endsWith("\n\nUser task:\n" + task)));
  assert.equal((await readFile(f.env.LAUNCH_CWD, "utf8")).trim(), f.project);
  await assert.rejects(readFile(join(f.project, "SHOULD_NOT_EXIST")), /ENOENT/);
  const failed = spawnSync(process.execPath, [entry, "--project", f.project, "--launch"], { env: { ...f.env, LAUNCH_EXIT: "17" }, encoding: "utf8" });
  assert.equal(failed.status, 17);
});

test("native Pi parser sees leading @/flags as task prose, never files or routing overrides", async t => {
  const f = await fixture(t);
  const host = await hostPath();
  const { parseArgs } = await import(pathToFileURL(join(host, "dist/cli/args.js")).href);
  const { loadSkills, formatSkillsForPrompt } = await import(pathToFileURL(join(host, "dist/core/skills.js")).href);
  const { AgentSession } = await import(pathToFileURL(join(host, "dist/core/agent-session.js")).href);
  const loaded = loadSkills({ cwd: f.project, agentDir: f.agent, skillPaths: [join(root, "skills/addy-engineering/SKILL.md")], includeDefaults: false });
  assert.match(formatSkillsForPrompt(loaded.skills), /addy-engineering/, "Discoverable skill is advertised through Pi's native loader");
  for (const task of ["-p", "--system-prompt /unapproved", "@/unapproved/private-input.txt"]) {
    const checked = f.run("--task", task); assert.equal(checked.status, 0, checked.stderr);
    const report = JSON.parse(checked.stdout), args = parseArgs(report.invocation.args);
    assert.deepEqual(args.fileArgs, []);
    assert.deepEqual(args.diagnostics, []);
    assert.deepEqual([...args.unknownFlags], []);
    for (const flag of ["print", "systemPrompt", "appendSystemPrompt", "noContextFiles", "resume", "continue", "model", "provider", "session", "mode"]) assert.equal(args[flag], undefined);
    assert.equal(args.messages.length, 1);
    assert.ok(args.messages[0].startsWith("/skill:addy-engineering "));
    assert.ok(args.messages[0].endsWith("\n\nUser task:\n" + task));
    // Call the installed pure expansion method with a test-owned resource receiver;
    // do not construct a session/runner or contact a provider.
    const expanded = AgentSession.prototype._expandSkillCommand.call({ resourceLoader: { getSkills: () => loaded } }, args.messages[0]);
    assert.ok(expanded.startsWith(`<skill name="addy-engineering" location="${join(root, "skills/addy-engineering/SKILL.md")}">`));
    assert.match(expanded, /## DEFINE/);
    assert.ok(expanded.endsWith("\n\nUser task:\n" + task));
    assert.equal(args.noMcp, true);
    assert.equal(args.noExtensions, true);
    assert.deepEqual(args.extensions, ["builtin:codemode", join(root, "extensions/delivery-tmux/index.ts")]);
    assert.deepEqual(args.skills, [join(root, "skills/addy-engineering/SKILL.md")]);
  }
  const file = join(f.dir, "approved-task.md"); await writeFile(file, "Advice only\n");
  const report = JSON.parse(f.run("--task-file", file).stdout);
  assert.deepEqual(parseArgs(report.invocation.args).fileArgs, [file]);
  await assert.rejects(readFile(f.env.LAUNCH_ARGS), /ENOENT/);
});

test("task-file is optional and cannot be shell-expanded or mistaken for implementation consent", async t => {
  const f = await fixture(t);
  const file = join(f.dir, "task with spaces.md"); await writeFile(file, "Advice only: inspect fixture\n");
  const run = f.run("--launch", "--task-file", file); assert.equal(run.status, 0, run.stderr);
  const args = await readFile(f.env.LAUNCH_ARGS, "utf8"); assert.ok(args.includes("@" + file));
  assert.match(args, /does not authorize implementation/i);
  assert.equal(f.run("--task", "one", "--task-file", file).status, 2);
  assert.equal(f.run("--task-file", join(f.dir, "missing.md")).status, 2);
});

test("unknown CLI options or missing/invalid project fail without launching", async t => {
  const f = await fixture(t);
  assert.equal(f.run("--override-rules").status, 2);
  assert.equal(f.run("--project", join(f.dir, "missing")).status, 2);
  assert.equal(spawnSync(process.execPath, [entry], { env: f.env, encoding: "utf8" }).status, 2);
  await assert.rejects(readFile(f.env.LAUNCH_ARGS), /ENOENT/);
});

test("guidance reads current outcomes, separates baseline and asks concise necessary permissions", async () => {
  const skill = await readFile(join(root, "skills/addy-engineering/SKILL.md"), "utf8");
  for (const rule of [/latest outcome\/handoff/, /historical pending checks/, /actual versus reused evidence/, /Do not compare a new task/, /not a green product-test baseline/, /validation route early/, /one concrete permission decision/, /authorized narrow read-only/, /one immediate next action/, /not.*duplicate implementation/]) assert.match(skill, rule);
  const guide = await readFile(join(root, "docs/addy-engineering.md"), "utf8");
  for (const rule of [/Project-aware entry aid/, /not exhaustive semantic/, /no bypass flag/i, /Task.*files.*optional|task-file suite/i, /not.*stored expectation/, /no.*--no-context-files/i]) assert.match(guide, rule);
});

test("launch accepts an entry-aid symlink without selecting another toolkit copy", async t => {
  const f = await fixture(t);
  const alias = join(f.dir, "entry-alias.mjs"); await symlink(entry, alias);
  const run = spawnSync(process.execPath, [alias, "--project", f.project, "--launch"], { env: f.env, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const args = await readFile(f.env.LAUNCH_ARGS, "utf8"); assert.ok(args.includes(join(root, "extensions/delivery-tmux/index.ts")));
});

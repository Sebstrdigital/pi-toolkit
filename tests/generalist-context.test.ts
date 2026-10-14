import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const readiness = await import(pathToFileURL(join(root, "scripts/generalist-context.mjs")).href);
const pace = await import(pathToFileURL(join(root, "extensions/pace-alias/index.ts")).href);
const git = (cwd: string, ...args: string[]) => { const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
async function repo(t: any) { const path = await mkdtemp(join(tmpdir(), "generalist-context-")); t.after(() => rm(path, { recursive: true, force: true })); git(path, "init", "-q"); git(path, "config", "user.email", "fixture@example.test"); git(path, "config", "user.name", "Fixture"); await writeFile(join(path, "gate.py"), "VALUE = 1\n"); git(path, "add", "."); git(path, "commit", "-qm", "initial"); return path; }
const record = (path: string, state: any = { version: 2, repositories: {} }) => readiness.saveRecord(path, { status: "success", coverage: "complete", revision: git(path, "rev-parse", "HEAD"), branch: git(path, "symbolic-ref", "--short", "HEAD"), snapshot: readiness.captureSourceSnapshot(path) }, state);

async function host(module: string) { const found = spawnSync("sh", ["-c", "command -v pi"], { encoding: "utf8" }); assert.equal(found.status, 0); let path = dirname(await realpath(found.stdout.trim())); for (;;) { try { if (JSON.parse(await readFile(join(path, "package.json"), "utf8")).name === "@earendil-works/pi-coding-agent") return import(pathToFileURL(join(path, "dist/core", module + ".js")).href); } catch {} const parent = dirname(path); assert.notEqual(parent, path); path = parent; } }

test("/pace uses canonical native skill loading, current skill bytes, collision and missing-skill guards", async t => {
  assert.equal(pace.expandPaceInput("/pace implement search"), "/skill:addy-engineering PACE. implement search"); assert.equal(pace.expandPaceInput("/pacemaker"), undefined);
  assert.equal(pace.validatePaceCommands([{ name: "skill:addy-engineering" }]), "ok"); assert.equal(pace.validatePaceCommands([{ name: "pace" }, { name: "skill:addy-engineering" }]), "collision"); assert.equal(pace.validatePaceCommands([]), "missing-skill");
  const { loadSkills } = await host("skills"), { AgentSession } = await host("agent-session"), { expandPromptTemplate } = await host("prompt-templates");
  const dir = await mkdtemp(join(tmpdir(), "pace-skill-")); t.after(() => rm(dir, { recursive: true, force: true })); const skill = join(dir, "SKILL.md"); await writeFile(skill, "---\nname: addy-engineering\ndescription: fixture\n---\nINITIAL\n");
  const loaded = loadSkills({ cwd: root, agentDir: join(root, "none"), includeDefaults: false, skillPaths: [skill] }); await writeFile(skill, "---\nname: addy-engineering\ndescription: fixture\n---\nCURRENT SKILL BYTES\n");
  const canonical = pace.expandPaceInput("/pace next")!, expanded = AgentSession.prototype._expandSkillCommand.call({ resourceLoader: { getSkills: () => loaded } }, canonical);
  assert.match(expanded, /CURRENT SKILL BYTES/); assert.match(expanded, /PACE\. next/);
  const nested = expandPromptTemplate("/pace next", [{ name: "pace", content: "/skill:addy-engineering PACE. $@" }]); assert.match(nested, /^\/skill:addy-engineering/); assert.doesNotMatch(AgentSession.prototype._expandSkillCommand.call({ resourceLoader: { getSkills: () => loaded } }, "/pace next"), /CURRENT SKILL BYTES/, "skill expansion precedes templates; nested template aliases are not reliable");
});
test("readiness is content based, deduplicates changes, and demands disk verification for relevant files", async t => {
  const path = await repo(t), state = record(path); assert.equal(readiness.inspectReadiness(path, state).state, "current");
  await writeFile(join(path, "gate.py"), "VALUE = 2\n"); const first = readiness.inspectReadiness(path, state, { relevantPaths: ["gate.py"] });
  assert.equal(first.state, "potentially-stale"); assert.equal(first.changedSourceFiles, 1); assert.equal(first.diskVerificationRequired, true);
  await writeFile(join(path, "gate.py"), "VALUE = 3\n"); assert.equal(readiness.inspectReadiness(path, state).state, "potentially-stale", "a second edit retains stale state");
  git(path, "add", "gate.py"); git(path, "commit", "-qm", "change"); await writeFile(join(path, "gate.py"), "VALUE = 4\n");
  assert.equal(readiness.inspectReadiness(path, state).changedSourceFiles, 1, "committed+dirty same path is unique");
});
test("rename/delete/untracked, thresholds, nonancestor, partial, failed and unavailable cases are honest", async t => {
  const commitsPath = await repo(t), commitsState = record(commitsPath); for (let i = 0; i < 5; i++) { await writeFile(join(commitsPath, "gate.py"), `VALUE = ${i + 2}\n`); git(commitsPath, "add", "gate.py"); git(commitsPath, "commit", "-qm", `commit ${i}`); } assert.equal(readiness.inspectReadiness(commitsPath, commitsState).refreshSuggested, true, "five commits suggests a refresh");
  const path = await repo(t), state = record(path); await writeFile(join(path, "new.py"), "x=1\n"); git(path, "mv", "gate.py", "renamed.py");
  let result = readiness.inspectReadiness(path, state); assert.equal(result.changedSourceFiles, 3); assert.equal(result.refreshSuggested, false);
  for (let i = 0; i < 9; i++) await writeFile(join(path, `extra${i}.py`), "x=1\n"); result = readiness.inspectReadiness(path, state); assert.equal(result.refreshSuggested, true);
  assert.equal(readiness.inspectReadiness(path, state, { serverAvailable: false }).state, "unavailable"); await writeFile(join(path, ".jcodemunch.jsonc"), "{\"watch\":true}"); assert.equal(readiness.inspectReadiness(path, state).state, "unknown", "project jCodeMunch configuration fails closed"); await rm(join(path, ".jcodemunch.jsonc"));
  const failed = readiness.saveRecord(path, { status: "failed", coverage: "partial", error: "index failed" }, { version: 2, repositories: {} }); assert.equal(readiness.inspectReadiness(path, failed).state, "failed");
  const partial = readiness.saveRecord(path, { status: "success", coverage: "partial" }, { version: 2, repositories: {} }); assert.equal(readiness.inspectReadiness(path, partial).state, "unknown");
  const bad = record(path); bad.repositories[Object.keys(bad.repositories)[0]].revision = "0000000000000000000000000000000000000000"; assert.equal(readiness.inspectReadiness(path, bad).state, "unknown");
});
test("declines are keyed to the same source state and successful metadata needs identity/loadability/full hashes", async t => {
  const path = await repo(t), state = { version: 2, repositories: {} }; readiness.declineIndex(path, state); assert.equal(readiness.inspectReadiness(path, state).needsPermission, false); await writeFile(join(path, "gate.py"), "VALUE = 2\n"); assert.equal(readiness.inspectReadiness(path, state).needsPermission, true);
  const snapshot = readiness.captureSourceSnapshot(path), metadata = { status: "loadable", index_present: true, git_head: git(path, "rev-parse", "HEAD"), git_root: path, coverage: "complete", source_snapshot: snapshot, files: ["gate.py"] };
  const saved = readiness.importSuccessfulMetadata(path, metadata, { version: 2, repositories: {} }); assert.equal(readiness.inspectReadiness(path, saved).state, "current");
  assert.throws(() => readiness.importSuccessfulMetadata(path, { ...metadata, coverage: "partial" }, { version: 2, repositories: {} }), /partial/);
  assert.throws(() => readiness.importSuccessfulMetadata(path, { ...metadata, git_root: "/tmp" }, { version: 2, repositories: {} }), /identity/);
});
test("configuration allowlists actual tools and installer rejects invalid pinned Context Mode paths", async t => {
  const config = readiness.mcpConfig({ contextServer: "/tmp/context/build/server.js" }); assert.equal(config.mcpServers.jcodemunch.toolExposure.get_symbol_source, "codemode"); assert.equal(config.mcpServers.jcodemunch.toolExposure.get_symbol, undefined); assert.equal(config.mcpServers.context_mode.toolExposure["*"], "hidden");
  const home = await mkdtemp(join(tmpdir(), "generalist-install-")); t.after(() => rm(home, { recursive: true, force: true })); const run = spawnSync("bash", [join(root, "install.sh"), "--with-generalist-context=/tmp/missing/server.js"], { env: { ...process.env, HOME: home }, encoding: "utf8" }); assert.equal(run.status, 1); assert.match(run.stderr, /regular existing file/);
  const candidate = join(home, "context/build/server.js"); await mkdir(dirname(candidate), { recursive: true }); await writeFile(candidate, "// fixture"); await writeFile(join(home, "context/package.json"), '{"name":"context-mode","version":"1.0.169"}'); await mkdir(join(home, ".pi/agent/prompts"), { recursive: true }); await writeFile(join(home, ".pi/agent/prompts/pace.md"), "keep"); const collision = spawnSync("bash", [join(root, "install.sh"), `--with-generalist-context=${candidate}`], { env: { ...process.env, HOME: home }, encoding: "utf8" }); assert.equal(collision.status, 1); assert.match(collision.stderr, /shadow existing \/pace prompt/);
});
test("docs state advisory routing, personal license boundary, metadata runbook and residual network behavior", async () => {
  const docs = await readFile(join(root, "docs/generalist-context.md"), "utf8"); for (const rule of [/untrusted advisory/i, /personal.*non-commercial/i, /not.*workaround/i, /list_repos/, /record-success/, /registry\.npmjs\.org/, /native codemode/i]) assert.match(docs, rule);
  const jcode = await readFile(join(root, "scripts/jcodemunch-server.mjs"), "utf8"); assert.match(jcode, /watcher=false/); assert.match(jcode, /JCODEMUNCH_USE_AI_SUMMARIES/);
});

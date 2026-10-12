import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, readdir, realpath, mkdtemp, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path: string) => readFile(join(root, path), "utf8");
const skillPath = "skills/addy-engineering/SKILL.md";
const vendor = "vendor/addy-agent-skills";
async function hostModule(module: string) {
  const found = spawnSync("sh", ["-c", "command -v pi"], { encoding: "utf8" });
  assert.equal(found.status, 0, "Actual installed Pi resource loader required");
  let path = dirname(await realpath(found.stdout.trim()));
  for (;;) {
    try {
      if (JSON.parse(await readFile(join(path, "package.json"), "utf8")).name === "@earendil-works/pi-coding-agent")
        return import(pathToFileURL(join(path, "dist/core", module + ".js")).href);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const parent = dirname(path); assert.notEqual(parent, path); path = parent;
  }
}

test("Pi natively discovers one adapted six-phase skill, not 25 upstream instructions", async () => {
  const { loadSkills, formatSkillsForPrompt } = await hostModule("skills");
  const loaded = loadSkills({ cwd: root, agentDir: join(root, "not-an-agent-dir"), includeDefaults: false, skillPaths: [join(root, skillPath)] });
  assert.deepEqual(loaded.diagnostics, []);
  assert.deepEqual(loaded.skills.map((s: any) => s.name), ["addy-engineering"]);
  assert.equal(loaded.skills[0].disableModelInvocation, false);
  assert.match(formatSkillsForPrompt(loaded.skills), /addy-engineering/);
  assert.match(formatSkillsForPrompt(loaded.skills), /six-phase\/six-step/);
  const discovered = loadSkills({ cwd: root, agentDir: join(root, "not-an-agent-dir"), includeDefaults: false, skillPaths: [join(root, "skills")] });
  assert.equal(discovered.skills.filter((s: any) => s.name === "addy-engineering").length, 1);
  assert.ok(!discovered.skills.some((s: any) => s.name === "spec-driven-development"));
});

test("installed directory aliases resolve external references through the physical skill directory", async t => {
  const dir = await mkdtemp(join(tmpdir(), "addy-skill-alias-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const alias = join(dir, "addy-engineering");
  await symlink(join(root, "skills/addy-engineering"), alias);
  const { loadSkills } = await hostModule("skills");
  const loaded = loadSkills({ cwd: root, agentDir: join(dir, "agent"), includeDefaults: false, skillPaths: [alias] });
  assert.equal(loaded.skills.length, 1);
  const physical = dirname(await realpath(loaded.skills[0].filePath));
  for (const path of ["references/pi-adaptations.md", "../../vendor/addy-agent-skills/LICENSE", "../../docs/addy-engineering.md"])
    assert.ok(await readFile(join(physical, path)), path);
  assert.match(await read(skillPath), /resolve all relative file links below from that physical directory/i);
});

test("pinned upstream inventory is complete, hash-checked, Markdown-only with MIT attribution", async () => {
  const pin = JSON.parse(await read(`${vendor}/UPSTREAM.json`));
  assert.equal(pin.repository, "https://github.com/addyosmani/agent-skills");
  assert.equal(pin.revision, "1be8e34187e34647bb83adc3a1323b26ae6f6abe");
  assert.equal(Object.keys(pin.files).filter(p => /^skills\/[^/]+\/SKILL.md$/.test(p)).length, 25);
  const paths: string[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(join(root, vendor, dir), { withFileTypes: true })) {
      const path = dir ? `${dir}/${entry.name}` : entry.name;
      assert.ok(!entry.isSymbolicLink(), path);
      if (entry.isDirectory()) await walk(path); else paths.push(path);
    }
  }
  await walk("");
  assert.deepEqual(paths.sort(), [...Object.keys(pin.files), "UPSTREAM.json"].sort());
  for (const [path, digest] of Object.entries(pin.files)) {
    assert.ok(path === "LICENSE" || path.endsWith(".md"), path);
    const bytes = await readFile(join(root, vendor, path));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), digest, path);
  }
  assert.match(await read(`${vendor}/LICENSE`), /MIT License/);
  assert.match(await read(`${vendor}/LICENSE`), /Addy Osmani/);
});

test("upstream shared references and adapted file pointers resolve", async () => {
  const pin = JSON.parse(await read(`${vendor}/UPSTREAM.json`));
  for (const path of Object.keys(pin.files).filter(p => p.endsWith(".md"))) {
    const source = await read(`${vendor}/${path}`);
    for (const match of source.matchAll(/`(\.\.\/\.\.\/references\/[^`]+\.md)`/g))
      assert.ok(await readFile(join(root, vendor, dirname(path), match[1])), `${path}: ${match[1]}`);
    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const link = match[1].split("#")[0];
      if (link && !/^\w+:/.test(link))
        assert.ok(await readFile(join(root, vendor, dirname(path), link)), `${path}: ${link}`);
    }
  }
  for (const path of [skillPath, "skills/addy-engineering/references/pi-adaptations.md", "skills/addy-engineering/references/execution.md", "docs/addy-engineering.md"]) {
    for (const match of (await read(path)).matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
      if (!/^https?:/.test(match[1])) assert.ok(await readFile(join(root, dirname(path), match[1])), `${path}: ${match[1]}`);
    }
  }
});

// Wording guards are not proof of model behavior; resource-loader assertions above are executable.
test("one adapted six-stage path retains define/plan content, brainstorming transition, and autonomous slices", async () => {
  const source = await read(skillPath);
  for (const stage of ["DEFINE", "PLAN", "BUILD", "VERIFY", "REVIEW", "SHIP"]) assert.match(source, new RegExp(`## ${stage}`));
  for (const rule of [/Objective/, /Commands/, /Structure/, /Style/, /Testing/, /Boundaries/, /risk-first/, /contract-first/, /RED/, /GREEN/, /root cause/, /integrated candidate/, /project.*commands/i, /ordinary.*repair/i, /open brainstorming/i, /short PLAN/i, /Direct BUILD/i, /usually PLAN/i, /not implementation.*authority/i]) assert.match(source, rule);
  const policy = await read("skills/addy-engineering/references/pi-adaptations.md");
  for (const rule of [/no mandatory.*SPEC.md/i, /no repeated approval/i, /no.*repair tokens/i, /no automatic commit/i, /suggestions.*nonblocking/i, /not.*universal/i, /cannot widen grants/i, /saved pins/i, /untrusted data/i]) assert.match(policy, rule);
});

test("final independent integrated Team review covers exact candidate and renews affected evidence", async () => {
  const source = await read(skillPath);
  for (const rule of [/Team.*final independent/i, /complete task-owned diff including added files/, /exact candidate/, /prior independent review/i, /affected evidence/i, /inspection-only/, /no-edit validator/, /lead alone accepts/i, /not.*release permission/i]) assert.match(source, rule);
});

test("workflow reuses guarded service tools without installing another scheduler", async () => {
  const source = await read("skills/addy-engineering/references/execution.md");
  for (const rule of [/createExecutionService/, /subagent_message/, /subagents_list/, /Developer.*Scout/, /same-workspace.*exclusive/i, /linked worktrees/, /model-only/, /not.*poll/i, /no nesting/i]) assert.match(source, rule);
  const installer = await read("scripts/install-options.mjs");
  assert.match(installer, /addy-engineering/);
  assert.doesNotMatch(installer, /with-addy|with-engineering/);
  const doc = await read("docs/addy-engineering.md");
  for (const rule of [/--no-skills/, /--skill/, /\/skill:addy-engineering/, /fresh session/i, /Default.*install/i, /Dikta/, /six-phase\/six-step/i, /not.*authority/i]) assert.match(doc, rule);
});

test("opt-in adaptation preserves release and private-data boundaries", async () => {
  const source = await read(skillPath) + await read("skills/addy-engineering/references/pi-adaptations.md");
  for (const rule of [/private-data/, /destructive/, /publication/, /do not stop/i, /browser.*MCP/i, /isolation/i, /Missing.*not passes/i, /no.*second scheduler/i]) assert.match(source, rule);
});

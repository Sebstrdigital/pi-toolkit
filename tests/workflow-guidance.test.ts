import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const root = fileURLToPath(new URL("../", import.meta.url));
const text = (path: string) => readFile(root + path, "utf8");
const policyPaths = ["agent/AGENTS.md", "skills/delivery/SKILL.md", "skills/discovery/SKILL.md", "docs/lean-workflows.md", "docs/delivery-workflow.md", "skills/delivery/references/delegation.md", "skills/delivery/references/authority-and-state.md"];

// Wording guards, not an LLM compliance or live task-completion demonstration.
test("execution authority is the understood task, not another mode/Agreement ceremony", async () => {
  for (const path of policyPaths) {
    const source = await text(path);
    assert.match(source, /clear.*(?:request|task execution request)/i, path);
    assert.match(source, /proposal|advice/i, path);
    assert.match(source, /no separate|do not require|without requiring/i, path);
    assert.doesNotMatch(source, /user explicitly selects|Selection.*authorizes preparation|approve.*actual Agreement before launching|at most (two|three|four).*fix cycles/i, path);
  }
});
test("brainstorming guidance suggests a proportionate six-phase transition without granting authority", async () => {
  const alwaysLoaded = await text("agent/AGENTS.md");
  const skill = await text("skills/addy-engineering/SKILL.md");
  for (const source of [alwaysLoaded, skill]) {
    assert.match(source, /brainstorming/i);
    assert.match(source, /DEFINE.*PLAN.*BUILD.*VERIFY.*REVIEW.*SHIP/s);
    assert.match(source, /not implementation authority|not.*implementation.*authority/i);
    assert.match(source, /usually (?:move to )?PLAN/i);
  }
  assert.match(skill, /Direct BUILD/);
});

test("ordinary corrections and supporting files are not permission tokens", async () => {
  for (const path of policyPaths.filter(path => !path.includes("discovery"))) {
    const source = await text(path);
    assert.match(source, /supporting/i, path);
    assert.match(source, /compiler/i, path);
    assert.match(source, /explicit|user.agreed|user.requested/i, path);
    assert.match(source, /no progress|progress stalls|change strategy/i, path);
    assert.match(source, /not.*repair tokens|not.*compiler.error quotas|not repair tokens|Do not invent.*repair/i, path);
  }
});
test("roles are proportional, workspace ownership and requested gates remain", async () => {
  for (const path of ["skills/delivery/SKILL.md", "docs/lean-workflows.md", "skills/delivery/references/delegation.md"]) {
    const source = await text(path);
    assert.match(source, /no mandatory|not.*compulsory/i);
    assert.match(source, /linked worktrees/i);
    assert.match(source, /same.workspace.*exclusive/i);
    assert.match(source, /requested.*gates/i);
    assert.match(source, /lead.*accepts|lead alone/i);
  }
});
test("sensitive test isolation is preserved independently of workflow ceremony", async () => {
  const guide = await text("docs/lean-workflows.md");
  for (const rule of [/before sensitive tests run/, /effective execution boundary/, /Invoking shell alone is not proof/, /If isolation is unverified or fails/, /required valid baseline before edits/, /not retroactive compliance/, /breach separately/, /Missing or excluded checks are not passes/]) assert.match(guide, rule);
  for (const path of policyPaths) {
    const source = await text(path);
    assert.match(source, /private.data|privacy/i, path);
    assert.match(source, /destructive|delete/i, path);
  }
});
test("evidence reuse does not waive acceptance or invent live qualification", async () => {
  const guide = await text("docs/lean-workflows.md");
  for (const rule of [/unchanged candidate\/conditions/, /affected checks/, /integrated/, /not assurance-only full reruns/, /untested runtime\/manual scenario/, /manual checklist/, /honest gaps/, /not customer acceptance or release permission/, /complete task-owned diff including added files/, /Truncation is not complete evidence/]) assert.match(guide, rule);
});
test("optional templates do not prescribe a quota or approval suite", async () => {
  for (const name of ["task", "agreement", "plan", "brief"]) {
    const source = await text(`skills/delivery/references/templates/${name}.md`);
    assert.match(source, /optional|not.*mandatory/i);
    assert.doesNotMatch(source, /at most \d.*repair|fresh builder per slice|metadata, not permission: execute sequentially|approved cumulative effort ceiling; no-progress/);
  }
});
test("saved pins, explicit limits and executable-code trust are preserved", async () => {
  const guide = await text("docs/lean-workflows.md");
  for (const rule of [/Saved sessions replay pinned grants\/model\/identity\/resource policy unchanged/, /Existing approvals and declared limits remain binding/, /No retroactive rewriting/, /no arbitrary 20-minute/, /Legacy unbound saved sessions retain/, /missing execution measurements fail closed/, /not an OS sandbox/, /Executable extension and MCP discovery remain denied/, /Legacy snapshots retain six original denials/, /no blind replay|Never blindly replay/]) assert.match(guide, rule);
});
test("approved routing is unchanged and availability is not entitlement", async () => {
  const source = await text("docs/lean-workflows.md");
  for (const rule of [/gpt-6-luna, low/, /gpt-5\.6-terra, medium/, /gpt-6\.1-sol, high/, /gpt-5\.6-terra, high/, /omission is analysis/, /No Astra/, /no.*automatic fallback/i, /Registry metadata does not prove backend entitlement/, /Saved sessions replay pinned old model\/effort unchanged/]) assert.match(source, rule);
});
test("fixed worker grants and bounded context remain", async () => {
  for (const [role, tools] of [["builder", "read,grep,find,ls,bash,edit,write,codemode"], ["validator", "read,grep,find,ls,bash,codemode"], ["reviewer", "read,grep,find,ls,codemode"], ["scout", "read,grep,find,ls,codemode"]]) {
    const source = await text(`vendor/pi-interactive-subagents/agents/${role}.md`);
    assert.ok(source.includes(`delivery-role: ${role}\ntools: ${tools}\n`));
    assert.match(source, /codemode/); assert.match(source, /truncation/);
  }
  const policy = await text("agent/AGENTS.md");
  assert.ok(Buffer.byteLength(policy) < 3100);
  assert.match(policy, /munin show <id>/); assert.match(policy, /Omit secrets/);
});
test("comparison names the user's TAKT and does not copy publication authority", async () => {
  const guide = await text("docs/lean-workflows.md");
  assert.match(guide, /03a7c1e/); assert.match(guide, /unrelated nrslib\/takt/);
  assert.match(guide, /three verification cycles and two review cycles/);
  assert.match(guide, /No default commit\/install\/delete\/force\/push\/PR\/publication authority/);
  assert.match(await text("README.md"), /docs\/lean-workflows.md/);
});

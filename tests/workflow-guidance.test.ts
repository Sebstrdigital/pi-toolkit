import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const text = (path: string) => readFile(resolve(root, path), "utf8");

// Structural regressions only: these assertions do not prove model behavior.
test("Developer guide documents actual narrow invocation and approval limits", async () => {
  const guide = await text("docs/lean-workflows.md");
  for (const rule of [/developer\(\{/, /selection: "Developer"/, /approvalRef:/, /packetRef:/,
    /purpose:/, /scope:/, /allowedPaths:/, /projectRules:/, /baseline:/, /validation:/, /acceptance:/, /task:/,
    /No full Brief\/Plan\/Agreement set is mandatory/, /not authentication of actual user consent/,
    /parent must verify the actual selection\/approval/, /cannot launch validator\/reviewer/,
    /Current parent model\/thinking propagate/, /original.*approvalRef.*packetRef/,
    /legacy Team only/, /Unknown|unknown\/malformed provenance/, /failed owned cleanup is retryable/,
    /fixed 20-minute timeout/, /parent alone inspects/, /fake transport tests are protocol evidence only/]) {
    assert.match(guide, rule);
  }
  assert.match(guide, /install\.sh --with-delivery-tmux/);
  assert.match(guide, /tmux and a persistent parent session/);
});
test("thin policy preserves safety and routes proportionate opt-in guidance", async () => {
  const policy = await text("agent/AGENTS.md");
  for (const preserved of [
    "Propose changes; wait for explicit approval before applying them.",
    "Trace claims to inspected evidence; do not guess.",
    "Ask before delete, force, push, publish, or other destructive/outward actions.",
    "Project rules belong in the repo's own AGENTS.md.",
    'munin recall "<query>" -p <project>',
    'munin remember "<summary>" -p <project>', "Omit secrets.",
    "use full prose for code, commits, and documents for others.",
  ]) assert.ok(policy.includes(preserved), preserved);
  assert.ok(Buffer.byteLength(policy) < 2200, "procedures belong in on-demand skills");
  for (const rule of [ /purpose/, /consequential gaps/, /sufficient evidence/, /budget/,
    /blockers.*relevance/, /park side quests/, /user explicitly selects/,
    /Direct work needs no mandatory files/, /Developer.*compact approved packet/,
    /actual Agreement before launch/, /draft Brief early/, /not every tool call/,
    /worker completion is not acceptance/, /tmux `developer` tool.*not bypassed delivery-only/,
  ]) assert.match(policy, rule);
});

test("one discovery skill synthesizes decisions and does not auto-select Team", async () => {
  assert.deepEqual(await readdir(resolve(root, "skills/discovery")), ["SKILL.md"]);
  const skill = await text("skills/discovery/SKILL.md");
  assert.match(skill, /^---\nname: discovery\ndescription: .+\n---/);
  for (const rule of [ /not a new questionnaire/, /consequential question/,
    /comparator/, /sufficient-evidence criteria/, /budget/, /cheaper safe alternative/,
    /failed or inconclusive/, /Park unrelated improvements/, /Direct/, /Developer/, /Team/,
    /requires the explicit narrow invocation `developer`/i,
    /Do not automatically select Team/, /actual Agreement before launching/,
  ]) assert.match(skill, rule);
  await stat(resolve(root, "skills/delivery/references/templates/brief.md"));
  await assert.rejects(stat(resolve(root, "skills/team")), { code: "ENOENT" });
});

test("Team opt-in retains compatibility and full purpose propagation", async () => {
  const skill = await text("skills/delivery/SKILL.md");
  assert.match(skill, /^---\nname: delivery\n/);
  for (const rule of [ /explicitly selected Team/, /Selection of Team authorizes preparation/,
    /actual Agreement before launching/, /without per-edit approval/,
    /Material.*changes need renewed approval/i, /full applicable Brief\/design\/Agreement/,
    /fresh no-edit validator/, /fresh independent reviewer/, /at most two fix cycles/,
    /not an OS sandbox/, /discovery are denied/, /no validator role/,
    /worker completion never/i, /lead explicitly/i,
  ]) assert.match(skill, rule);
  for (const path of ["references/delegation.md", "references/authority-and-state.md",
    "references/templates/brief.md", "references/templates/plan.md", "references/templates/agreement.md"]) {
    await stat(resolve(root, "skills/delivery", path));
  }
  const delegation = await text("skills/delivery/references/delegation.md");
  assert.match(delegation, /## Validator packet/);
  assert.match(delegation, /outcome fit/);
  assert.match(delegation, /including added files/);
  const guideLink = delegation.match(/`([^`]+lean-workflows\.md)` relative to this reference directory/);
  assert.ok(guideLink, "delegation must point to the exact Developer invocation guide");
  const guidePath = resolve(root, "skills/delivery/references", guideLink[1]);
  assert.equal(guidePath, resolve(root, "docs/lean-workflows.md"));
  assert.ok((await stat(guidePath)).isFile(), "documented relative guide link must exist");
});

test("templates and Plan reference pin authority and preserve unresolved state", async () => {
  const brief = await text("skills/delivery/references/templates/brief.md");
  const plan = await text("skills/delivery/references/templates/plan.md");
  const agreement = await text("skills/delivery/references/templates/agreement.md");
  assert.match(brief, /Customer problem and motivation/);
  assert.match(brief, /Observable customer behavior or decision evidence/);
  assert.match(plan, /Approved references \/ source revision/);
  assert.match(plan, /Evidence \/ blocker \/ next action/);
  assert.match(plan, /Lead acceptance/);
  assert.match(agreement, /exact approval/);
  assert.match(agreement, /content hash or immutable git revision/);
  assert.match(agreement, /actual Agreement before worker launch/);
  assert.match(agreement, /without repeated permission/);
  assert.match(agreement, /No default commit\/install\/destructive cleanup\/push\/PR\/publish authority/);
  const state = await text("skills/delivery/references/authority-and-state.md");
  for (const value of ["pending", "active", "blocked", "paused", "cancelled", "abandoned", "accepted"]) {
    assert.ok(state.includes(`**${value}:**`), value);
    assert.ok(plan.includes(value), value);
  }
  for (const rule of [ /lead alone updates acceptance/, /not a new JSON framework or scheduler/,
    /same revision/, /source mismatch blocks launch/, /renewed approval/,
    /maps accepted to completed \*\*only\*\*/, /\[blocked\]/, /\[paused\]/,
    /\[cancelled\]/, /\[abandoned\]/, /Filter its bundled scratchpad skill/,
    /no invented percentages/i, /Opt-in widget projection/, /No prompt or static test guarantees universal/,
  ]) assert.match(state, rule);
});

test("fixed role frontmatter grants stay pinned and prose preserves purpose", async () => {
  for (const [role, tools] of [
    ["builder", "read,grep,find,ls,bash,edit,write"],
    ["validator", "read,grep,find,ls,bash"],
    ["reviewer", "read,grep,find,ls"],
  ]) {
    const profile = await text(`vendor/pi-interactive-subagents/agents/${role}.md`);
    const expected = `---\nname: ${role}\ndescription: ${
      role === "builder" ? "Implement the coordinator-approved delivery packet." :
      role === "validator" ? "Validate the coordinator-approved delivery changes without editing." :
      "Independently inspect delivery changes and evidence without mutation or shell."
    }\ndelivery-role: ${role}\ntools: ${tools}\nsystem-prompt: append\nauto-exit: true\ninteractive: false\nsession-mode: standalone\n---\n`;
    assert.ok(profile.startsWith(expected), `${role} fixed metadata changed`);
    assert.match(profile, /full applicable approved customer-purpose/);
    assert.match(profile, /exact revisions/);
    assert.match(profile, /coordinator.*acceptance/i);
  }
  for (const role of ["builder", "reviewer"]) {
    const profile = await text(`agents/${role}.md`);
    assert.match(profile, /full applicable.*purpose/);
    assert.match(profile, /exact revisions/);
    assert.match(profile, /not task acceptance/);
  }
});

test("user docs link guidance and retain every follow-up category without readiness claims", async () => {
  const guide = await text("docs/lean-workflows.md");
  for (const rule of [ /Direct/, /Developer/, /Team/, /dedicated model-only sequential `developer` tool/,
    /actual Agreement before launch/, /not an OS sandbox/, /not universal/,
    /capability\/product specifications/, /JSON task state/, /dependency scheduling/,
    /transcript renderers/, /worker telemetry/, /revision pinning/, /budget checkpoints/,
    /discovery\/experiment agents/, /model routing/, /parallel execution/,
    /project-rule migrations/, /stack-specific validation/, /rollback and upgrade diagnostics/,
    /Jev/, /Hermes/, /rollback records remain later gates/,
  ]) assert.match(guide, rule);
  const readme = await text("README.md");
  assert.match(readme, /\(docs\/lean-workflows.md\)/);
  assert.match(readme, /\/skill:discovery/);
  assert.match(readme, /\/skill:delivery/);
  assert.match(readme, /no duplicate Team controller/);
  const workflow = await text("docs/delivery-workflow.md");
  assert.match(workflow, /docs\/lean-workflows.md/);
  assert.match(workflow, /no validator role/);
  assert.match(workflow, /no-edit validator/);
});

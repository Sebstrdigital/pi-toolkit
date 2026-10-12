import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DispatchQueue, resolveWorkerWorkspace } from "../extensions/delivery-tmux/workspace.ts";
import { DELIVERY_TOOLS, isSubagentLoadout, type SubagentLoadout } from "../vendor/pi-interactive-subagents/pi-extension/subagents/session.ts";

test("workspace preflight admits only the checkout or linked worktrees, including path aliases", t => {
  const dir = mkdtempSync(join(tmpdir(), "delivery-workspaces-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, "repo"), tree = join(dir, "tree with spaces"), other = join(dir, "other");
  mkdirSync(other);
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "-c", "core.hooksPath=/dev/null", ...args], {
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" }, stdio: "pipe",
  });
  git("init", "-q", "--template=", root); git("-C", root, "commit", "--allow-empty", "-qm", "fixture");
  git("-C", root, "worktree", "add", "--detach", tree);
  assert.equal(resolveWorkerWorkspace(root), realpathSync(root));
  assert.equal(resolveWorkerWorkspace(root, root + "/."), realpathSync(root));
  assert.equal(resolveWorkerWorkspace(root, tree), realpathSync(tree));
  assert.equal(resolveWorkerWorkspace(tree, root), realpathSync(root));
  assert.throws(() => resolveWorkerWorkspace(root, other), /linked worktree/);
  assert.throws(() => resolveWorkerWorkspace(root, join(dir, "missing")), /unavailable/);
  assert.throws(() => resolveWorkerWorkspace(root, "\0"), /Invalid/);
});

test("serialized dispatch prevents shared launch metadata races, without serializing worker lifetimes", async () => {
  const queue = new DispatchQueue(); const dispatched: string[] = [], workers = new Set<string>();
  await Promise.all(["first", "second"].map(async name => {
    const release = await queue.acquire();
    try { dispatched.push(name); await Promise.resolve(); workers.add(name); }
    finally { release(); }
  }));
  assert.deepEqual(dispatched, ["first", "second"]);
  assert.equal(workers.size, 2);
  await assert.rejects((async () => { const release = await queue.acquire(); try { throw new Error("fixture"); } finally { release(); } })(), /fixture/);
  const release = await queue.acquire(); release();
});

test("new context policy is validated while saved legacy snapshots remain unchanged", () => {
  const legacy: SubagentLoadout = { deliveryRole: "builder", agent: "builder", toolAllowlist: DELIVERY_TOOLS.builder,
    model: "openai/gpt-5.6-sol", thinking: "high", systemPromptMode: "append", identity: "Legacy task",
    spawnable: null, autoExit: true, cwd: "/fixture", agentDir: null };
  const saved = JSON.stringify(legacy);
  assert.equal(isSubagentLoadout(legacy), true);
  assert.equal(isSubagentLoadout({ ...legacy, resourcePolicy: "project-context" }), true);
  assert.equal(isSubagentLoadout({ ...legacy, resourcePolicy: "unrestricted" }), false);
  assert.equal(isSubagentLoadout({ ...legacy, resourcePolicy: null }), false);
  assert.equal(JSON.stringify(legacy), saved);
});

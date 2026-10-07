import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// Deliberately runs in a separate process: no real tmux command, provider,
// credential directory, or worker is reachable through this controlled PATH.
test("accepted runtime closes a created pane when launch transport fails", async t => {
  const directory = await mkdtemp(join(tmpdir(), "delivery-tmux-startup-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const located = spawnSync("sh", ["-c", "command -v pi"], { encoding: "utf8" });
  assert.equal(located.status, 0, "Installed Pi is required; missing host is not acceptance");
  const cli = await realpath(located.stdout.trim());
  let host = dirname(cli);
  for (;;) {
    try {
      const manifest = JSON.parse(await readFile(join(host, "package.json"), "utf8"));
      if (manifest.name === "@earendil-works/pi-coding-agent") break;
    } catch {}
    const parent = dirname(host);
    assert.notEqual(parent, host, "Cannot resolve installed Pi package from CLI");
    host = parent;
  }
  const loader = join(host, "dist/core/extensions/loader.js");
  const eventBus = join(host, "dist/core/event-bus.js");
  const bin = join(directory, "bin");
  const agent = join(directory, "agent");
  await mkdir(bin);
  await mkdir(agent);
  const log = join(directory, "tmux.log");
  await writeFile(join(bin, "tmux"), `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_TMUX_LOG"
case "$1" in
  split-window) printf '%%fake-owned\\n'; exit 0 ;;
  send-keys) exit 23 ;;
  kill-pane|select-layout) exit 0 ;;
  *) exit 24 ;;
esac
`, { mode: 0o755 });
  const session = join(directory, "parent.jsonl");
  await writeFile(session, JSON.stringify({ type: "session", version: 3, id: "parent", cwd: directory }) + "\n");
  const program = `
    const { loadExtensions } = await import(${JSON.stringify(loader)});
    const { createEventBus } = await import(${JSON.stringify(eventBus)});
    const loaded = await loadExtensions([${JSON.stringify(resolve(root, "vendor/pi-interactive-subagents/pi-extension/subagents/index.ts"))}], ${JSON.stringify(directory)}, createEventBus());
    if (loaded.errors.length) throw new Error(JSON.stringify(loaded.errors));
    const extension = loaded.extensions[0];
    const ctx = { cwd: ${JSON.stringify(directory)}, hasUI: false, sessionManager: {
      getSessionFile: () => ${JSON.stringify(session)},
      getSessionId: () => "parent",
      getSessionDir: () => ${JSON.stringify(directory)},
    }};
    for (const handler of extension.handlers.get("session_start") ?? []) await handler({}, ctx);
    let failure;
    try {
      await extension.tools.get("subagent").definition.execute("probe", { agent: "builder", name: "startup-probe", task: "No worker may run." }, undefined, undefined, ctx);
    } catch (error) { failure = String(error); }
    for (const handler of extension.handlers.get("session_shutdown") ?? []) await handler({}, ctx);
    await new Promise(resolve => setTimeout(resolve, 180));
    console.log(JSON.stringify({ failure }));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", program], {
    cwd: directory,
    env: {
      ...process.env,
      HOME: directory,
      PI_CODING_AGENT_DIR: agent,
      PATH: `${bin}:/usr/bin:/bin`,
      TMUX: "fake-only",
      TMUX_PANE: "%fake-parent",
      FAKE_TMUX_LOG: log,
      PI_SUBAGENT_SHELL_READY_DELAY_MS: "0",
      PI_SUBAGENT_AGENT: "",
      PI_SUBAGENT_ALLOWED: "",
      PI_OFFLINE: "1",
    },
    encoding: "utf8",
    timeout: 15000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /send-keys/, "Transport failure must be reproduced before asserting cleanup");
  const calls = await readFile(log, "utf8");
  assert.match(calls, /split-window/, "Probe must create only the fake owned surface");
  assert.match(calls, /kill-pane -t %fake-owned/, "Launch failure and shutdown must close the created owned pane");
  assert.doesNotMatch(calls, /select-layout/, "Delivery split and rollback must not retile the parent window");
  assert.equal((calls.match(/kill-pane/g) ?? []).length, 1, "Successful rollback is idempotent on shutdown");
});

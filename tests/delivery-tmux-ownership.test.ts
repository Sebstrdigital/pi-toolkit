import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const runtime = join(root, "vendor/pi-interactive-subagents/pi-extension/subagents/index.ts");

async function installedHost() {
  const located = spawnSync("sh", ["-c", "command -v pi"], { encoding: "utf8" });
  assert.equal(located.status, 0, "Missing installed Pi is not acceptance");
  let host = dirname(await realpath(located.stdout.trim()));
  for (;;) {
    try {
      if (JSON.parse(await readFile(join(host, "package.json"), "utf8")).name === "@earendil-works/pi-coding-agent") return host;
    } catch {}
    const parent = dirname(host);
    assert.notEqual(parent, host, "Installed loader not found");
    host = parent;
  }
}

for (const mode of ["fresh", "resume"] as const) {
  for (const failure of ["setup", "transport", "partial-transport", "cleanup-retry", "reload-retry", "teardown-race"] as const) {
    test(`${mode}: ${failure} preserves launch error, ownership, and parent layout`, async t => {
      const directory = await mkdtemp(join(tmpdir(), "delivery-tmux-ownership-"));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const host = await installedHost();
      const bin = join(directory, "bin");
      const agent = join(directory, "agent");
      const artifact = join(directory, "artifacts/parent");
      await mkdir(bin);
      await mkdir(agent);
      await mkdir(artifact, { recursive: true });
      const log = join(directory, "tmux.log");
      const obstruction = join(artifact, mode === "fresh" ? "subagent-scripts" : "subagent-resume");
      await writeFile(join(bin, "tmux"), `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_TMUX_LOG"
case "$1" in
  split-window)
    if [ "$FAILURE" = setup ]; then printf blocked > "$OBSTRUCTION"; fi
    printf '%%fake-owned\\n'; exit 0 ;;
  send-keys)
    if [ "$FAILURE" = partial-transport ] && [ "$4" = -l ]; then exit 0; fi
    exit 23 ;;
  kill-pane)
    n=0
    if [ -f "$FAKE_TMUX_LOG.count" ]; then read n < "$FAKE_TMUX_LOG.count"; fi
    n=$((n+1)); printf '%s\\n' "$n" > "$FAKE_TMUX_LOG.count"
    if [ "$FAILURE" = cleanup-retry ] || [ "$FAILURE" = reload-retry ]; then
      if [ "$n" -lt 3 ]; then exit 29; fi
    fi
    exit 0 ;;
  *) exit 24 ;;
esac
`, { mode: 0o755 });
      const parent = join(directory, "parent.jsonl");
      const child = join(directory, "child.jsonl");
      await writeFile(parent, JSON.stringify({ type: "session", version: 3, id: "parent", cwd: directory }) + "\n");
      await writeFile(child, JSON.stringify({ type: "session", version: 3, id: "child", cwd: directory }) + "\n");
      await writeFile(`${child}.loadout.json`, JSON.stringify({
        deliveryRole: "builder", agent: "builder", toolAllowlist: "read,grep,find,ls,bash,edit,write,ask_question",
        model: null, thinking: "medium", systemPromptMode: null, identity: null,
        spawnable: null, autoExit: true, cwd: directory, agentDir: agent,
      }));
      await writeFile(join(artifact, "subagent-registry.json"), JSON.stringify({ probe: { sessionFile: child, sessionId: "child" } }));
      // Tests use the public installed loader. This process cannot invoke a real
      // pane or worker: all tmux operations are fake and pi is absent from PATH.
      const program = `
        const { loadExtensions } = await import(${JSON.stringify(join(host, "dist/core/extensions/loader.js"))});
        const { createEventBus } = await import(${JSON.stringify(join(host, "dist/core/event-bus.js"))});
        const loaded = await loadExtensions([${JSON.stringify(runtime)}], ${JSON.stringify(directory)}, createEventBus());
        if (loaded.errors.length) throw new Error(JSON.stringify(loaded.errors));
        const extension = loaded.extensions[0];
        const ctx = { cwd: ${JSON.stringify(directory)}, hasUI: false, sessionManager: {
          getSessionFile: () => ${JSON.stringify(parent)}, getSessionId: () => 'parent', getSessionDir: () => ${JSON.stringify(directory)},
        }};
        for (const handler of extension.handlers.get('session_start') ?? []) await handler({}, ctx);
        let failure;
        try {
          const launching = extension.tools.get(${JSON.stringify(mode === "fresh" ? "subagent" : "subagent_message")}).definition.execute('probe',
            ${JSON.stringify(mode === "fresh" ? { agent: "builder", name: "probe", task: "Never run a worker." } : { name: "probe", message: "Never run a worker." })},
            undefined, undefined, ctx);
          ${failure === "teardown-race" ? `for (const handler of extension.handlers.get('session_shutdown') ?? []) await handler({}, ctx);` : ""}
          await launching;
        } catch (error) { failure = String(error); }
        if (!failure) throw new Error('Expected original launch failure');
        const shutdownErrors = [];
        const attempts = ${JSON.stringify(failure === "reload-retry" ? 1 : 3)};
        for (let i = 0; i < attempts; i++) {
          for (const handler of extension.handlers.get('session_shutdown') ?? []) {
            try { await handler({}, ctx); } catch (error) { shutdownErrors.push(String(error)); }
          }
        }
        ${failure === "reload-retry" ? `
        const reloaded = await loadExtensions([${JSON.stringify(runtime)}], ${JSON.stringify(directory)}, createEventBus());
        if (reloaded.errors.length) throw new Error(JSON.stringify(reloaded.errors));
        for (const handler of reloaded.extensions[0].handlers.get('session_shutdown') ?? []) await handler({}, ctx);
        ` : ""}
        await new Promise(resolve => setTimeout(resolve, 180));
        console.log(JSON.stringify({ failure, shutdownErrors }));
      `;
      const result = spawnSync(process.execPath, ["--input-type=module", "-e", program], {
        cwd: directory, encoding: "utf8", timeout: 15000,
        env: { ...process.env, HOME: directory, PI_CODING_AGENT_DIR: agent, PATH: `${bin}:/usr/bin:/bin`,
          TMUX: "fake", TMUX_PANE: "%fake-parent", FAKE_TMUX_LOG: log, OBSTRUCTION: obstruction, FAILURE: failure,
          PI_SUBAGENT_SHELL_READY_DELAY_MS: failure === "teardown-race" ? "100" : "0", PI_SUBAGENT_AGENT: "", PI_SUBAGENT_ALLOWED: "", PI_OFFLINE: "1" },
      });
      assert.equal(result.status, 0, result.stderr);
      const output = JSON.parse(result.stdout.trim());
      assert.match(output.failure, failure === "setup" ? /EEXIST/ : failure === "teardown-race" ? /cancelled during parent teardown/ : /send-keys/);
      assert.doesNotMatch(output.failure, /kill-pane/, "Cleanup must not replace original launch error");
      const calls = await readFile(log, "utf8");
      assert.match(calls, /split-window/);
      assert.doesNotMatch(calls, /select-layout/);
      assert.doesNotMatch(calls, /kill-pane -t %fake-parent/);
      assert.equal((calls.match(/kill-pane -t %fake-owned/g) ?? []).length, failure.endsWith("retry") ? 3 : 1);
      if (failure === "setup" || failure === "teardown-race") assert.doesNotMatch(calls, /send-keys/);
      if (failure === "partial-transport") {
        assert.equal((calls.match(/send-keys/g) ?? []).length, 2);
        assert.match(output.failure, /Enter/);
      }
      if (failure.endsWith("retry")) assert.equal(output.shutdownErrors.length, 1);
      const { readdir } = await import("node:fs/promises");
      async function failureEvidence(path: string): Promise<string[]> {
        const found: string[] = [];
        for (const entry of await readdir(path, { withFileTypes: true })) {
          if (entry.isDirectory()) found.push(...await failureEvidence(join(path, entry.name)));
          else if (entry.name.endsWith(".launch-failure.json")) found.push(join(path, entry.name));
        }
        return found;
      }
      const evidence = await failureEvidence(directory);
      assert.equal(evidence.length, 1);
      const classification = JSON.parse(await readFile(evidence[0], "utf8"));
      assert.equal(classification.status, "cancelled");
      assert.equal(classification.error, output.failure);
    });
  }
}

for (const transportFails of [true, false]) {
  for (const previouslyOwned of [false, true]) {
  test(`caller-supplied surface is never closed by its borrower (${transportFails ? "failed launch" : "cancelled watcher"}; existing owner: ${previouslyOwned})`, async t => {
    const directory = await mkdtemp(join(tmpdir(), "delivery-tmux-unowned-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const host = await installedHost();
    const bin = join(directory, "bin");
    const agent = join(directory, "agent");
    await mkdir(bin); await mkdir(agent);
    const log = join(directory, "tmux.log");
    await writeFile(join(bin, "tmux"), `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_TMUX_LOG"
case "$1" in
  send-keys) exit ${transportFails ? 23 : 0} ;;
  split-window) printf '%%caller\\n'; exit 0 ;;
  kill-pane) exit 0 ;;
  *) exit 24 ;;
esac
`, { mode: 0o755 });
    const parent = join(directory, "parent.jsonl");
    await writeFile(parent, JSON.stringify({ type: "session", version: 3, id: "parent", cwd: directory }) + "\n");
    const probe = join(directory, "probe.ts");
    await writeFile(probe, `import runtime, { __test__ } from ${JSON.stringify(runtime)};
      import { createOwnedSurface } from ${JSON.stringify(join(dirname(runtime), "surface-ownership.ts"))};
      import { readFileSync } from 'node:fs';
      export default function(pi) {
        runtime(pi);
        pi.registerTool({ name: 'probe', parameters: {}, async execute(_id, _params, _signal, _update, ctx) {
          if (${previouslyOwned}) createOwnedSurface('existing-owner', {runId:'original-owner', sessionFile:${JSON.stringify(parent)}, delivery:true});
          let launchFailed = false;
          try {
            const running = await __test__.launchSubagent({agent:'builder',name:'probe',task:'No worker.'}, ctx, {surface:'%caller'});
            const controller = new AbortController(); controller.abort();
            const result = await __test__.watchSubagent(running, controller.signal);
            if (result.error !== 'cancelled') throw new Error('Cancellation incorrectly classified');
          } catch (error) {
            if (!${transportFails} || !String(error).includes('send-keys')) throw error;
            launchFailed = true;
          }
          if (${transportFails} && !launchFailed) throw new Error('Transport failure was not reproduced');
          if (readFileSync(${JSON.stringify(log)}, 'utf8').includes('kill-pane')) throw new Error('Borrower closed caller-supplied surface');
          return {content:[],details:{}};
        }});
      }`);
    const program = `
      const { loadExtensions } = await import(${JSON.stringify(join(host, "dist/core/extensions/loader.js"))});
      const { createEventBus } = await import(${JSON.stringify(join(host, "dist/core/event-bus.js"))});
      const loaded = await loadExtensions([${JSON.stringify(probe)}], ${JSON.stringify(directory)}, createEventBus());
      if (loaded.errors.length) throw new Error(JSON.stringify(loaded.errors));
      const ctx = { cwd:${JSON.stringify(directory)}, hasUI:false, sessionManager:{
        getSessionFile:()=>${JSON.stringify(parent)}, getSessionId:()=> 'parent', getSessionDir:()=>${JSON.stringify(directory)}
      }};
      const extension = loaded.extensions[0];
      await extension.tools.get('probe').definition.execute('id',{},undefined,undefined,ctx);
      for (const handler of extension.handlers.get('session_shutdown') ?? []) await handler({},ctx);
      await new Promise(resolve=>setTimeout(resolve,180));
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", program], {
      cwd: directory, encoding: "utf8", timeout: 15000,
      env: { ...process.env, HOME:directory, PI_CODING_AGENT_DIR:agent, PATH:`${bin}:/usr/bin:/bin`,
        TMUX:"fake", TMUX_PANE:"%fake-parent", FAKE_TMUX_LOG:log, PI_SUBAGENT_AGENT:"", PI_SUBAGENT_ALLOWED:"", PI_OFFLINE:"1" },
    });
    assert.equal(result.status, 0, result.stderr);
    const calls = await readFile(log, "utf8");
    assert.match(calls, /send-keys -t %caller/);
    assert.doesNotMatch(calls, /select-layout/);
    if (previouslyOwned) assert.equal((calls.match(/kill-pane/g) ?? []).length, 1, 'Only the original owner closes on shutdown');
    else assert.doesNotMatch(calls, /kill-pane|split-window/);
  });
  }
}

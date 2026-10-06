import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { getEventListeners } from "node:events";
import { run } from "../scripts/delivery-agent.ts";
import { tmpdir } from "node:os";
import { WorkerController } from "../extensions/delivery-worker/controller.ts";
import { WorkerProgress } from "../scripts/worker-progress.ts";

const params = { role: "reviewer" as const, project: "/project", packet: "/packet", output: "/evidence" };
const truncate = (text: string, width: number) => text.slice(0, width);
function harness(throws = false) {
  let component: any;
  let clear = 0;
  let color = "a";
  const frames: string[][] = [];
  const ctx: any = { mode: "tui", ui: { setWidget(_key: string, factory: any, options: any) {
    if (!factory) { clear++; component?.dispose(); if (throws) throw new Error("clear"); return; }
    assert.equal(options.placement, "aboveEditor");
    component = factory({ requestRender() { frames.push(component.render(40)); if (throws) throw new Error("redraw"); } }, { fg(_key: string, text: string) { return color + text; } });
  } } };
  return { ctx, frames, get component() { return component; }, get clear() { return clear; }, theme() { color = "b"; } };
}

test("fake interactive lifecycle shows live and terminal states, role, tokens, activity, narrow widths and theme invalidation", async () => {
  const h = harness();
  const controller = new WorkerController(truncate, async options => {
    const p = new WorkerProgress();
    options.onProgress!(p.snapshot());
    p.observe({ type: "agent_settled" });
    options.onProgress!(p.snapshot());
    p.terminal("completed");
    options.onProgress!(p.snapshot());
    return 0;
  });
  const result = await controller.execute(params, undefined, h.ctx);
  assert.equal(result.details.exitCode, 0);
  assert.match(h.frames[0][0], /reviewer running/);
  assert.match(h.frames[1][0], /finalizing/);
  assert.match(h.frames[2][0], /completed/);
  assert.match(h.frames[0][1], /usage pending.*activity none/);
  assert.match(h.component.render(100)[0], /acceptance\/review pending/);
  for (const width of [0, 1, 10, 20, 40, 80, 120]) {
    const lines = h.component.render(width);
    assert.equal(lines.length, 2);
    for (const line of lines) assert.ok(line.length <= width);
  }
  h.theme(); h.component.invalidate();
  assert.ok(h.component.render(100)[0].startsWith("b"));
  await controller.shutdown(); await controller.shutdown();
  assert.equal(h.clear, 1);
});

test("compact progress prioritizes tool failures and never reveals thought, arguments or raw errors", async () => {
  const h = harness();
  const controller = new WorkerController(truncate, async options => {
    const p = new WorkerProgress();
    p.observe({ type: "tool_execution_start", toolCallId: "one", toolName: "read", args: { secret: "SECRET" } } as any);
    p.observe({ type: "tool_execution_start", toolCallId: "two", toolName: "bash" } as any);
    p.observe({ type: "tool_execution_end", toolCallId: "one", isError: true, result: { content: "SECRET ERROR" } } as any);
    p.observe({ type: "message_update", usage: { input: 2, output: 3, cacheRead: 4, cacheWrite: 5, totalTokens: 14 }, assistantMessageEvent: { type: "thinking_delta", delta: "SECRET THOUGHT" } } as any);
    options.onProgress!(p.snapshot()); return 0;
  });
  await controller.execute(params, undefined, h.ctx);
  const narrow = h.component.render(40);
  assert.match(narrow[0], /reviewer running.*tool errors 1/);
  assert.match(narrow[1], /tok 14.*idle/);
  const wide = h.component.render(160).join("\n");
  assert.match(wide, /compact unavailable/);
  assert.match(wide, /in 2 out 3 cache 4\/5/);
  assert.ok(!wide.includes("SECRET"));
  await controller.shutdown();
});

test("UI exceptions including clear, render, setup and launch failure never leak ownership", async () => {
  const h = harness(true);
  const controller = new WorkerController(truncate, async options => {
    options.onProgress!(new WorkerProgress().snapshot()); return 0;
  });
  assert.equal((await controller.execute(params, undefined, h.ctx)).details.exitCode, 0);
  await controller.shutdown();
  const broken: any = { mode: "tui", ui: { setWidget() { throw new Error("setup"); } } };
  const failed = new WorkerController(() => { throw new Error("render"); }, async () => { throw new Error("transport"); });
  await assert.rejects(failed.execute(params, undefined, broken), /transport/);
  await failed.shutdown();
  const render = new WorkerController(() => { throw new Error("render"); }, async () => 0);
  const ui = harness();
  await render.execute(params, undefined, ui.ctx);
  assert.deepEqual(ui.component.render(40), []);
  await render.shutdown();
});

test("concurrent execute/shutdown cancels owned deferred launch and prevents new work", async () => {
  let aborted = false;
  const controller = new WorkerController(truncate, async options => {
    aborted = options.signal!.aborted;
    return 130;
  });
  const h = harness();
  const running = controller.execute(params, undefined, h.ctx);
  const concurrent = controller.execute(params, undefined, h.ctx);
  const shutdown = controller.shutdown();
  await assert.rejects(concurrent, /already running/);
  await assert.rejects(controller.execute(params, undefined, h.ctx), /shutting down/);
  assert.equal((await running).details.exitCode, 130);
  await shutdown;
  assert.equal(aborted, true);
  assert.equal(h.clear, 1);
});

test("external abort is forwarded, non-TUI mode needs no UI and workers can run sequentially", async () => {
  const abort = new AbortController(); abort.abort();
  const controller = new WorkerController(truncate, async options => options.signal!.aborted ? 130 : 0);
  assert.equal((await controller.execute(params, abort.signal, { mode: "json" } as any)).details.exitCode, 130);
  assert.equal((await controller.execute(params, undefined, { mode: "json" } as any)).details.exitCode, 0);
  await controller.shutdown();
});

test("native final status EISDIR and preflight rejection leave failed widgets and release sequential ownership", async t => {
  const base = await mkdtemp(resolve(tmpdir(), "pi-widget-failure-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const packet = resolve(base, "packet.md");
  const fake = resolve(base, "fake.mjs");
  const output = resolve(base, "failed-evidence");
  await writeFile(packet, "Approved fake task");
  const events = [{ type: "session" }, { type: "message_end", message: { role: "assistant", stopReason: "stop", content: [{ type: "text", text: "Report" }] } }, { type: "agent_settled" }].map(e => JSON.stringify(e) + "\n").join("");
  await writeFile(fake, `
    import { renameSync, mkdirSync } from 'node:fs';
    for await (const chunk of process.stdin) {}
    if (process.argv[2] === 'fail-save') {
      renameSync(${JSON.stringify(resolve(output, "status.json"))}, ${JSON.stringify(resolve(output, "status-initial.json"))});
      mkdirSync(${JSON.stringify(resolve(output, "status.json"))});
    }
    await new Promise(done => setTimeout(done, 350));
    process.stdout.write(${JSON.stringify(events)});
  `);
  const states: string[] = [];
  let transportError: unknown;
  const controller = new WorkerController(truncate, async options => {
    try { return await run({ ...options, onProgress: p => { states.push(p.state); options.onProgress?.(p); } }); }
    catch (error) { transportError = error; throw error; }
  });
  const h = harness(true); // Redraw/clear throw without replacing the filesystem error.
  const abort = new AbortController();
  const options = { role: "builder" as const, project: base, packet, output, piCommand: [process.execPath, fake, "fail-save"] };
  const listeners = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
  await assert.rejects(controller.execute(options, abort.signal, h.ctx), error => {
    assert.equal(error, transportError);
    assert.equal((error as any).code, "EISDIR");
    return true;
  });
  assert.match(h.component.render(160)[0], /builder failed/);
  assert.ok(!states.includes("completed"));
  assert.equal(states.at(-1), "failed");
  assert.equal(await readFile(resolve(output, "report.md"), "utf8"), "Report\n");
  assert.equal(JSON.parse(await readFile(resolve(output, "status-initial.json"), "utf8")).task_accepted, false);
  assert.deepEqual([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")], listeners);
  assert.equal(getEventListeners(abort.signal, "abort").length, 0);

  const existing = resolve(base, "existing");
  await mkdir(existing);
  states.length = 0;
  await assert.rejects(controller.execute({ ...options, output: existing }, abort.signal, h.ctx), error => {
    assert.equal(error, transportError);
    assert.equal((error as any).code, "EEXIST");
    return true;
  });
  assert.deepEqual(states, []); // Native setup rejected before any progress callback.
  assert.match(h.component.render(160)[0], /builder failed/);
  assert.ok(!h.component.render(160).join(" ").includes("starting"));
  assert.equal(getEventListeners(abort.signal, "abort").length, 0);
  const result = await controller.execute({ ...options, output: resolve(base, "success"), piCommand: [process.execPath, fake] }, undefined, h.ctx);
  assert.equal(result.details.exitCode, 0);
  assert.equal(result.details.task_accepted, false);
  assert.match(h.component.render(160)[0], /builder completed/);
  await controller.shutdown();
});

test("rejection overrides even frozen completion while preserving metadata and isolating all UI errors", async () => {
  const original = new Error("SECRET transport error");
  for (const fault of ["none", "setup", "render", "redraw", "clear"]) {
    const h = harness(fault === "redraw" || fault === "clear");
    if (fault === "setup") h.ctx.ui.setWidget = () => { throw new Error("setup"); };
    const controller = new WorkerController(fault === "render" ? () => { throw new Error("render"); } : truncate, async options => {
      let now = 5000;
      const p = new WorkerProgress(() => now);
      p.observe({ type: "message_update", usage: { input: 2, output: 3, cacheRead: 4, cacheWrite: 5, totalTokens: 14 }, assistantMessageEvent: { type: "text_delta" } } as any);
      now = 8000;
      p.terminal("completed");
      options.onProgress!(p.snapshot());
      throw original;
    });
    await assert.rejects(controller.execute(params, undefined, h.ctx), error => error === original);
    if (fault === "none" || fault === "redraw" || fault === "clear") {
      const lines = h.component.render(160).join("\n");
      assert.match(lines, /reviewer failed 3s/);
      assert.match(lines, /tok 14.*idle 3s/);
      assert.ok(!lines.includes("SECRET"));
    }
    await controller.shutdown();
  }
});

// Optional installed-Pi integration: no model, settings mutation or global links.
test("installed Pi loader registers actual extension and fake worker drives real controller widget", async t => {
  const piRoot = resolve(dirname(process.execPath), "../lib/node_modules/@earendil-works/pi-coding-agent");
  try { await access(resolve(piRoot, "dist/index.js")); }
  catch { t.skip("Pi is not installed adjacent to this Node executable"); return; }
  const { loadExtensions, createExtensionRuntime } = await import(pathToFileURL(resolve(piRoot, "dist/core/extensions/loader.js")).href);
  const require = createRequire(resolve(piRoot, "package.json"));
  const { truncateToWidth, visibleWidth } = await import(pathToFileURL(require.resolve("@earendil-works/pi-tui")).href);
  const root = fileURLToPath(new URL("../", import.meta.url));
  const loaded = await loadExtensions([resolve(root, "extensions/delivery-worker/index.ts")], root, undefined, createExtensionRuntime());
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.extensions.length, 1);
  const registered = loaded.extensions[0].tools.get("delivery_worker").definition;
  assert.equal(registered.exposure, "model-only");
  assert.equal(registered.executionMode, "sequential");
  assert.ok(loaded.extensions[0].handlers.has("session_shutdown"));
  const base = await mkdtemp(resolve(tmpdir(), "pi-widget-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const packet = resolve(base, "packet.md");
  const fake = resolve(base, "fake.mjs");
  await writeFile(packet, "Approved fake task");
  await writeFile(fake, `
    for await (const chunk of process.stdin) {}
    process.stdout.write(JSON.stringify({type:'session'})+'\\n');
    process.stdout.write(JSON.stringify({type:'agent_start'})+'\\n');
    await new Promise(done => setTimeout(done, 1100));
    process.stdout.write(JSON.stringify({type:'message_end',message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:'Status: completed'}]}})+'\\n');
    process.stdout.write(JSON.stringify({type:'agent_settled'})+'\\n');
  `);
  const frames: string[][] = [];
  let component: any;
  let themeColor = "\x1b[31m";
  const ctx: any = { mode: "tui", ui: { setWidget(_key: string, factory: any) {
    if (!factory) { component?.dispose(); return; }
    component = factory({ requestRender() { frames.push(component.render(80)); } }, { fg(_key: string, text: string) { return themeColor + text + '\x1b[0m'; } });
  } } };
  // Actual native transport and Pi width helpers, no agent/model runtime.
  const controller = new WorkerController(truncateToWidth);
  assert.equal((await controller.execute({ role: "builder", project: base, packet, output: resolve(base, "evidence"), piCommand: [process.execPath, fake] }, undefined, ctx)).details.exitCode, 0);
  assert.ok(frames.some(lines => lines[0].includes("running")));
  assert.ok(frames.some(lines => lines[0].includes("completed")));
  for (const width of [0, 1, 20, 40, 80, 120]) for (const line of component.render(width)) assert.ok(visibleWidth(line) <= width);
  themeColor = "\x1b[32m"; component.invalidate();
  assert.ok(component.render(80)[0].includes(themeColor));
  assert.equal(JSON.parse(await readFile(resolve(base, "evidence/status.json"), "utf8")).task_accepted, false);
  await controller.shutdown();
});

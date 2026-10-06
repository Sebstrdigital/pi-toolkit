import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import fsPromises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import {
  access, chmod, mkdtemp, mkdir, readFile, rm, writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  command, extractReport, run,
} from "../scripts/delivery-agent.ts";

function assistant(reason = "stop", text = "Status: completed") {
  return {
    type: "message_end",
    message: {
      role: "assistant",
      stopReason: reason,
      content: [{ type: "text", text }],
    },
  };
}

function stream(message = assistant(), settled = true): string {
  const events: object[] = [{ type: "session" }, message];
  if (settled) events.push({ type: "agent_settled" });
  return events.map(event => JSON.stringify(event) + "\n").join("");
}

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const base = await mkdtemp(resolve(tmpdir(), "pi-delivery-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const packet = resolve(base, "task.md");
  const output = resolve(base, "attempt");
  const fake = resolve(base, "fake.mjs");
  await writeFile(packet, "Approved task packet");

  async function worker(data: string, code = 0, delay = 0) {
    await writeFile(fake, `
      import { writeFileSync } from "node:fs";
      let packet = "";
      for await (const chunk of process.stdin) packet += chunk;
      writeFileSync("received.txt", packet);
      writeFileSync("args.json", JSON.stringify(process.argv.slice(2)));
      process.stdout.write(${JSON.stringify(data)});
      process.stderr.write("fake diagnostic\\n");
      setTimeout(() => process.exit(${code}), ${delay});
    `);
    return [process.execPath, fake];
  }
  async function invoke(
    data: string, code = 0, delay = 0, timeout = 5,
  ) {
    return run({
      role: "reviewer", project: base, packet, output, timeout,
      piCommand: await worker(data, code, delay),
    });
  }
  const status = async () => JSON.parse(
    await readFile(resolve(output, "status.json"), "utf8"),
  );
  return { base, packet, output, worker, invoke, status };
}

test("completion, packet delivery, evidence, and reviewer restrictions", async t => {
  const f = await fixture(t);
  let completed = false;
  assert.equal(await run({
    role: "reviewer", project: f.base, packet: f.packet, output: f.output,
    piCommand: await f.worker(stream()),
    onProgress: p => {
      if (p.state !== "completed") return;
      // Synchronous inspection at the callback boundary, not after run returns.
      const status = JSON.parse(readFileSync(resolve(f.output, "status.json"), "utf8"));
      completed = status.status === "completed" && status.task_accepted === false
        && readFileSync(resolve(f.output, "report.md"), "utf8") === "Status: completed\n"
        && readFileSync(resolve(f.output, "events.jsonl"), "utf8") === stream()
        && readFileSync(resolve(f.output, "stderr.log"), "utf8").includes("fake diagnostic");
    },
  }), 0);
  assert.equal(completed, true);
  assert.equal((await f.status()).status, "completed");
  assert.equal((await f.status()).task_accepted, false);
  assert.equal(
    await readFile(resolve(f.output, "report.md"), "utf8"),
    "Status: completed\n",
  );
  assert.equal(
    await readFile(resolve(f.base, "received.txt"), "utf8"),
    await readFile(f.packet, "utf8"),
  );
  const args: string[] = JSON.parse(
    await readFile(resolve(f.base, "args.json"), "utf8"),
  );
  assert.equal(args[args.indexOf("--tools") + 1], "read,grep,find,ls");
  for (const flag of [
    "--no-session", "--no-approve", "--no-extensions", "--no-mcp",
    "--no-skills", "--no-prompt-templates", "--no-themes", "--offline",
  ]) assert.ok(args.includes(flag));
  assert.ok(!args.includes("--no-context-files"));
  assert.ok(!args.includes("--model"));
  assert.match(
    await readFile(resolve(f.output, "stderr.log"), "utf8"),
    /fake diagnostic/,
  );
});

test("final status EISDIR publishes failed, never completed, and retains evidence", async t => {
  const f = await fixture(t);
  const fake = resolve(f.base, "fake.mjs");
  await writeFile(fake, `
    import { renameSync, mkdirSync } from 'node:fs';
    for await (const chunk of process.stdin) {}
    renameSync(${JSON.stringify(resolve(f.output, "status.json"))}, ${JSON.stringify(resolve(f.output, "status-initial.json"))});
    mkdirSync(${JSON.stringify(resolve(f.output, "status.json"))});
    await new Promise(done => setTimeout(done, 350));
    process.stdout.write(${JSON.stringify(stream(assistant(), false))});
    await new Promise(done => setTimeout(done, 350));
    process.stdout.write(JSON.stringify({ type: 'agent_settled' }) + '\\n');
  `);
  const states: string[] = [];
  let failure: any;
  try {
    await run({ role: "builder", project: f.base, packet: f.packet, output: f.output,
      piCommand: [process.execPath, fake], onProgress: p => {
        states.push(p.state); throw new Error("UI must not replace EISDIR");
      } });
    assert.fail("Expected persistence rejection");
  } catch (error) { failure = error; }
  assert.equal(failure.code, "EISDIR");
  assert.equal(failure.path, resolve(f.output, "status.json"));
  assert.ok(states.includes("finalizing"));
  assert.equal(states.at(-1), "failed");
  assert.ok(!states.includes("completed"));
  assert.equal(await readFile(resolve(f.output, "report.md"), "utf8"), "Status: completed\n");
  assert.equal(await readFile(resolve(f.output, "events.jsonl"), "utf8"), stream());
  assert.equal(JSON.parse(await readFile(resolve(f.output, "status-initial.json"), "utf8")).task_accepted, false);
});

test("initial status persistence rejection publishes failed and preserves error identity", async t => {
  const f = await fixture(t);
  const original = new Error("initial status write");
  const states: string[] = [];
  const write = fsPromises.writeFile;
  t.mock.method(fsPromises, "writeFile", async (...args: Parameters<typeof write>) => {
    if (args[0] === resolve(f.output, "status.json")) throw original;
    return write(...args);
  });
  syncBuiltinESMExports();
  t.after(async () => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  await assert.rejects(run({ role: "builder", project: f.base, packet: f.packet, output: f.output,
    onProgress: p => { states.push(p.state); throw new Error("UI"); } }), error => error === original);
  assert.deepEqual(states, ["failed"]);
  await assert.rejects(access(resolve(f.output, "events.jsonl")));
});

for (const fault of ["write", "close"] as const) {
  test(`controlled evidence handle ${fault} failure cannot announce completion`, async t => {
    const f = await fixture(t);
    const piCommand = await f.worker(stream());
    const original = new Error(`controlled ${fault} failure`);
    const open = fsPromises.open;
    let closed = 0;
    t.mock.method(fsPromises, "open", async (...args: Parameters<typeof open>) => {
      const handle = await open(...args);
      const close = handle.close.bind(handle);
      t.mock.method(handle, "close", async () => {
        await close(); closed++;
        if (fault === "close" && args[0] === resolve(f.output, "events.jsonl")) throw original;
      });
      if (fault === "write" && args[0] === resolve(f.output, "events.jsonl")) {
        t.mock.method(handle, "writeFile", async () => { throw original; });
      }
      return handle;
    });
    syncBuiltinESMExports();
    t.after(async () => { t.mock.restoreAll(); syncBuiltinESMExports(); });
    const states: string[] = [];
    assert.equal(await run({ role: "builder", project: f.base, packet: f.packet, output: f.output,
      piCommand, onProgress: p => states.push(p.state) }), 1);
    assert.equal((await f.status()).status, "failed");
    assert.equal((await f.status()).task_accepted, false);
    assert.equal(states.at(-1), "failed");
    assert.ok(!states.includes("completed"));
    assert.equal(closed, 2);
  });
}

test("builder receives the explicit write and shell tool list", () => {
  const args = command("builder", "role");
  assert.equal(
    args[args.indexOf("--tools") + 1],
    "read,grep,find,ls,bash,edit,write",
  );
});

test("zero process exit does not hide assistant errors", async t => {
  const f = await fixture(t);
  assert.equal(await f.invoke(stream(assistant("error"))), 1);
  assert.equal((await f.status()).status, "failed");
});

test("nonzero process exit fails even with a normal report", async t => {
  const f = await fixture(t);
  assert.equal(await f.invoke(stream(), 7), 1);
  assert.equal((await f.status()).process_exit_code, 7);
});

test("malformed evidence is preserved", async t => {
  const f = await fixture(t);
  assert.equal(await f.invoke("not json\n"), 1);
  assert.equal(
    await readFile(resolve(f.output, "events.jsonl"), "utf8"),
    "not json\n",
  );
});

test("refuses existing output before spawning", async t => {
  const f = await fixture(t);
  await mkdir(f.output);
  const marker = resolve(f.output, "keep");
  await writeFile(marker, "unchanged");
  await assert.rejects(f.invoke(stream()), { code: "EEXIST" });
  assert.equal(await readFile(marker, "utf8"), "unchanged");
  await assert.rejects(access(resolve(f.base, "received.txt")));
});

test("invalid timeout creates no output", async t => {
  const f = await fixture(t);
  await assert.rejects(f.invoke(stream(), 0, 0, NaN), /Timeout/);
  await assert.rejects(access(f.output));
});

test("missing executable records failure", async t => {
  const f = await fixture(t);
  assert.equal(await run({
    role: "builder", project: f.base, packet: f.packet, output: f.output,
    piCommand: [resolve(f.base, "nonexistent")],
  }), 1);
  assert.equal((await f.status()).status, "failed");
});

test("timeout stops the worker and records incomplete status", async t => {
  const f = await fixture(t);
  assert.equal(await f.invoke(stream(), 0, 10_000, 0.1), 124);
  assert.equal((await f.status()).status, "timed_out");
});

test("protocol validation, recovery, and Unicode framing", async t => {
  const f = await fixture(t);
  const path = resolve(f.base, "events.jsonl");
  for (const data of [
    stream(assistant("error")),
    stream(assistant("aborted")),
    stream(assistant("length")),
    stream(assistant("toolUse")),
    stream(assistant("stop", "")),
    stream(assistant(), false),
    stream().slice(0, -1),
    JSON.stringify(assistant()) + "\n",
    stream() + JSON.stringify({ type: "agent_start" }) + "\n",
    stream() + JSON.stringify({ type: "agent_end" }) + "\n",
    stream() + JSON.stringify({ type: "agent_start" }) + "\n"
      + JSON.stringify({ type: "agent_settled" }) + "\n",
    stream() + JSON.stringify({ type: "session" }) + "\n",
    "null\n",
    "[]\n",
  ]) {
    await writeFile(path, data);
    await assert.rejects(extractReport(path));
  }
  await writeFile(path, stream(assistant("stop", "A\u2028B")));
  assert.equal(await extractReport(path), "A\u2028B\n");
  await writeFile(
    path,
    stream(assistant("error"), false)
      + JSON.stringify(assistant()) + "\n"
      + JSON.stringify({ type: "agent_settled" }) + "\n",
  );
  assert.equal(await extractReport(path), "Status: completed\n");
});

test("CLI launches a fake pi from PATH without calling a model", async t => {
  const f = await fixture(t);
  await f.worker(stream());
  const bin = resolve(f.base, "bin");
  await mkdir(bin);
  const fakePi = resolve(bin, "pi");
  await writeFile(fakePi, "#!/usr/bin/env node\n" + await readFile(
    resolve(f.base, "fake.mjs"), "utf8",
  ));
  await chmod(fakePi, 0o700);
  const cli = new URL("../scripts/delivery-agent.ts", import.meta.url);
  const result = spawnSync(process.execPath, [
    fileURLToPath(cli), "reviewer", "--project", f.base, "--packet", f.packet,
    "--output", f.output,
  ], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    encoding: "utf8", timeout: 5000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await f.status()).status, "completed");
});

test("SIGTERM-resistant workers are killed after the grace period", async t => {
  const f = await fixture(t);
  await f.worker(stream(), 0, 10_000);
  const fake = resolve(f.base, "fake.mjs");
  await writeFile(fake, "process.on('SIGTERM', () => {});\n" + await readFile(
    fake, "utf8",
  ));
  assert.equal(await run({
    role: "builder", project: f.base, packet: f.packet, output: f.output,
    timeout: 0.5, piCommand: [process.execPath, fake],
  }), 124);
  assert.equal((await f.status()).status, "timed_out");
  assert.equal((await f.status()).process_signal, "SIGKILL");
});

test("callback throws before, during and after completion do not change outcome; silence ticks are live", async t => {
  const f = await fixture(t);
  const snapshots: any[] = [];
  const code = await run({
    role: "builder", project: f.base, packet: f.packet, output: f.output,
    piCommand: await f.worker(stream(), 0, 1250),
    onProgress: p => { snapshots.push(p); throw new Error("renderer broke"); },
  });
  assert.equal(code, 0);
  assert.equal((await f.status()).status, "completed");
  assert.equal(snapshots[0].state, "running");
  assert.ok(snapshots.some(p => p.state === "finalizing"));
  assert.equal(snapshots.at(-1).state, "completed");
  assert.ok(snapshots.some(p => p.activityAgeSeconds > 0.5));
  assert.ok(snapshots.some(p => p.elapsedSeconds > 0.5 && p.state !== "completed"));
});

test("abort while quiet disposes worker, signal listeners and timers", async t => {
  const f = await fixture(t);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 150);
  t.after(async () => clearTimeout(timer));
  assert.equal(await run({
    role: "builder", project: f.base, packet: f.packet, output: f.output,
    piCommand: await f.worker("", 0, 10000), signal: abort.signal,
  }), 130);
  assert.equal((await f.status()).status, "interrupted");
});

test("large streams honor backpressure, retain every byte and throttle snapshots", async t => {
  const f = await fixture(t);
  const delta = JSON.stringify({ type: "message_update", usage: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, totalTokens: 3 }, assistantMessageEvent: { type: "text_delta", delta: "x".repeat(2048) } }) + "\n";
  const data = JSON.stringify({ type: "session" }) + "\n" + delta.repeat(10000)
    + stream().split("\n").slice(1).join("\n");
  const fake = resolve(f.base, "fake.mjs");
  await writeFile(fake, `
    import { once } from 'node:events';
    for await (const chunk of process.stdin) {}
    const delta = ${JSON.stringify(delta)};
    const write = async text => { if (!process.stdout.write(text)) await once(process.stdout, 'drain'); };
    await write(${JSON.stringify(JSON.stringify({ type: "session" }) + "\n")});
    for (let i = 0; i < 10000; i++) await write(delta);
    await write(${JSON.stringify(stream().split("\n").slice(1).join("\n"))});
  `);
  let callbacks = 0;
  assert.equal(await run({
    role: "reviewer", project: f.base, packet: f.packet, output: f.output,
    piCommand: [process.execPath, fake], onProgress: () => { callbacks++; },
  }), 0);
  assert.equal(await readFile(resolve(f.output, "events.jsonl"), "utf8"), data);
  assert.ok(callbacks < 100, `Expected throttling, got ${callbacks}`);
});

test("oversized and truncated protocol evidence fail closed and remains byte exact", async t => {
  for (const data of [stream().slice(0, -1), JSON.stringify({ type: "session" }) + "\n" + "x".repeat(8 * 1024 * 1024 + 1)]) {
    const f = await fixture(t);
    const fake = resolve(f.base, "fake.mjs");
    const source = resolve(f.base, "source");
    await writeFile(source, data);
    await writeFile(fake, `
      import { createReadStream } from 'node:fs';
      import { pipeline } from 'node:stream/promises';
      for await (const chunk of process.stdin) {}
      await pipeline(createReadStream(${JSON.stringify(source)}), process.stdout);
    `);
    assert.equal(await run({ role: "builder", project: f.base, packet: f.packet, output: f.output, piCommand: [process.execPath, fake] }), 1);
    assert.equal((await f.status()).status, "failed");
    assert.equal(await readFile(resolve(f.output, "events.jsonl"), "utf8"), data);
  }
});

test("CLI broken stderr does not invalidate worker completion", async t => {
  const f = await fixture(t);
  await f.worker(stream(), 0, 300);
  const bin = resolve(f.base, "bin");
  await mkdir(bin);
  await writeFile(resolve(bin, "pi"), "#!/usr/bin/env node\n" + await readFile(resolve(f.base, "fake.mjs"), "utf8"));
  await chmod(resolve(bin, "pi"), 0o700);
  const child = spawn(process.execPath, [fileURLToPath(new URL("../scripts/delivery-agent.ts", import.meta.url)), "reviewer", "--project", f.base, "--packet", f.packet, "--output", f.output], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr!.destroy();
  const code = await new Promise(done => child.once("close", done));
  assert.equal(code, 0);
  assert.equal((await f.status()).status, "completed");
});

test("SIGTERM records interruption", { timeout: 10_000 }, async t => {
  const f = await fixture(t);
  const piCommand = await f.worker(stream(), 0, 10_000);
  const harness = resolve(f.base, "harness.mjs");
  const moduleUrl = new URL("../scripts/delivery-agent.ts", import.meta.url).href;
  await writeFile(harness, `
    import { run } from ${JSON.stringify(moduleUrl)};
    process.exitCode = await run(${JSON.stringify({
      role: "builder", project: f.base, packet: f.packet,
      output: f.output, timeout: 30, piCommand,
    })});
  `);
  const child = spawn(process.execPath, [harness], { stdio: "ignore" });
  const closed = new Promise<number | null>(done => child.once("close", done));
  try {
    const deadline = Date.now() + 5000;
    while (true) {
      try {
        await access(resolve(f.base, "received.txt"));
        break;
      } catch {
        assert.ok(Date.now() < deadline, "Fake worker failed to start");
        await new Promise(done => setTimeout(done, 20));
      }
    }
    child.kill("SIGTERM");
    assert.equal(await closed, 130);
    assert.equal((await f.status()).status, "interrupted");
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await closed;
    }
  }
});

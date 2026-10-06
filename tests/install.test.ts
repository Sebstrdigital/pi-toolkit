import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtemp, mkdir, readFile, readlink, rm, writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

async function home(t: { after: (fn: () => Promise<void>) => void }) {
  const path = await mkdtemp(resolve(tmpdir(), "pi-install-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

function install(home: string) {
  return spawnSync("bash", [resolve(root, "install.sh")], {
    env: { ...process.env, HOME: home },
    encoding: "utf8",
    timeout: 5000,
  });
}

test("installer creates all links and is repeatable", async t => {
  const path = await home(t);
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = install(path);
    assert.equal(result.status, 0, result.stderr);
  }
  assert.equal(
    await readlink(resolve(path, ".pi/agent/extensions/delivery-worker")),
    resolve(root, "extensions/delivery-worker"),
  );
  assert.equal(
    await readlink(resolve(path, ".pi/agent/AGENTS.md")),
    resolve(root, "agent/AGENTS.md"),
  );
  for (const name of [
    "debug", "grill-me", "zoom-out", "duadigital-pdf-maker",
    "homelab-validation", "delivery",
  ]) {
    assert.equal(
      await readlink(resolve(path, ".pi/agent/skills", name)),
      resolve(root, "skills", name),
    );
  }
});

test("installer refuses conflicting extension files and dangling links in fake HOME", async t => {
  for (const dangling of [false, true]) {
    const path = await home(t);
    const extensions = resolve(path, ".pi/agent/extensions");
    await mkdir(extensions, { recursive: true });
    const conflict = resolve(extensions, "delivery-worker");
    if (dangling) {
      const { symlink } = await import("node:fs/promises");
      await symlink(resolve(path, "missing"), conflict);
    } else await writeFile(conflict, "keep extension");
    const result = install(path);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing to overwrite/);
    if (dangling) assert.equal(await readlink(conflict), resolve(path, "missing"));
    else assert.equal(await readFile(conflict, "utf8"), "keep extension");
  }
});

test("installer refuses and preserves conflicting delivery destination", async t => {
  const path = await home(t);
  const skills = resolve(path, ".pi/agent/skills");
  await mkdir(skills, { recursive: true });
  const conflict = resolve(skills, "delivery");
  await writeFile(conflict, "keep this file");
  const result = install(path);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to overwrite/);
  assert.equal(await readFile(conflict, "utf8"), "keep this file");
});

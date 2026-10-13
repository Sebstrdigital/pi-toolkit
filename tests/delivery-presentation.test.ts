import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const host = resolve(execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim(), "@earendil-works/pi-coding-agent");

test("completion and failure hints refer to original scoped invocation, not bare executable resumes", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-delivery-presentation-"));
  const wrapper = join(dir, "extension.ts");
  writeFileSync(wrapper, `import {__test__} from ${JSON.stringify(join(root, "vendor/pi-interactive-subagents/pi-extension/subagents/index.ts"))};
    globalThis.presentationTest = __test__; export default function() {}`);
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    const {loadExtensions} = await import(${JSON.stringify(join(host, "dist/core/extensions/loader.js"))});
    const {createEventBus} = await import(${JSON.stringify(join(host, "dist/core/event-bus.js"))});
    const loaded = await loadExtensions([${JSON.stringify(wrapper)}], ${JSON.stringify(dir)}, createEventBus());
    assert.deepEqual(loaded.errors, []);
    const present = globalThis.presentationTest.resolveResultPresentation;
    for (const extra of [{}, {exitCode:1}, {errorMessage:'provider failed'}, {error:'paused'}, {error:'cancelled'}]) {
      const output = present({exitCode:0, elapsed:10, summary:'Outcome with caveat', ...extra}, 'worker');
      assert.ok(!output.includes('subagent_message({'), 'No misleading bare executable example');
      assert.match(output, /original scoped invocation/);
      assert.match(output, /Developer.*approvalRef.*packetRef/);
      assert.match(output, /Scout.*discoveryAuthorityRef/);
      assert.match(output, /declared Team.*approvalRef.*packetRef/);
      assert.match(output, /limits.*pins/);
      if (extra.error) assert.match(output, /No completion is claimed/);
    }
  `], { encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

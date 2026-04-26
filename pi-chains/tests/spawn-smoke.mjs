import { spawnStep } from "../src/spawner.ts";
import { resolveRole } from "../src/role-resolver.ts";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const role = resolveRole("scout", process.cwd());
console.log("Role resolved:", role);

const sessionDir = mkdtempSync(join(tmpdir(), "pi-chains-smoke-"));
console.log("Session dir:", sessionDir);

const result = await spawnStep({
  step: { role: "scout", prompt: "" },
  role,
  prompt: "Say only: SMOKE_OK and nothing else.",
  sessionFile: join(sessionDir, "scout.jsonl"),
  resumeSession: false,
});
console.log("Exit:", result.exitCode, "elapsed:", result.elapsedMs, "ms");
console.log("Output:");
console.log(result.output);

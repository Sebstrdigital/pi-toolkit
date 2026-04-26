import { discoverChains } from "../src/chains-loader.ts";
import { resolveRole, listInstalledRoles } from "../src/role-resolver.ts";
import { renderPrompt } from "../src/runner.ts";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ext = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chains = discoverChains(ext, ext);
console.log("Discovered chains:", chains.map(c => c.name));
for (const c of chains) {
  console.log("\n---", c.name, "---");
  console.log("desc:", c.description);
  console.log("steps:", c.steps.map(s => s.role).join(" → "));
  for (const step of c.steps) {
    const role = resolveRole(step.role, ext);
    console.log(`  ${step.role}: tools=${role.allowedTools}`);
  }
  const r = renderPrompt(c.steps[1]?.prompt ?? c.steps[0].prompt, {
    original: "ORIG_TASK",
    input: "PRIOR_OUTPUT",
    steps: [{ role: c.steps[0].role, output: "OUT0", exitCode: 0, elapsedMs: 1 }],
  });
  console.log("rendered (sample):\n", r);
}
console.log("\nInstalled roles via resolver:", listInstalledRoles(ext));

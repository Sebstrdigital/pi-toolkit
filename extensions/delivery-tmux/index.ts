import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createExecutionService } from "./execution.ts";
import { registerExecutionTools } from "./tools.ts";

/** Compatibility entry point: existing tools over the shared guarded service. */
export default async function deliveryTmux(pi: ExtensionAPI) {
  registerExecutionTools(pi, await createExecutionService(pi));
}

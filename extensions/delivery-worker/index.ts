import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { WorkerController } from "./controller.ts";

export default function (pi: ExtensionAPI) {
  const controller = new WorkerController(truncateToWidth);
  pi.on("session_shutdown", async () => { await controller.shutdown(); });
  pi.registerTool(defineTool({
    name: "delivery_worker",
    label: "Delivery worker",
    description: "Coordinator only: run one fresh builder or reviewer after explicit approval of the execution contract. Wait for completion; inspect evidence and independently review before acceptance. Never delegate recursively or launch parallel writers.",
    exposure: "model-only",
    executionMode: "sequential",
    parameters: Type.Object({
      role: Type.Union([Type.Literal("builder"), Type.Literal("reviewer")], { description: "Approved worker role; reviewer is inspection-only." }),
      project: Type.String({ description: "Project root directory." }),
      packet: Type.String({ description: "Existing approved task packet path." }),
      output: Type.String({ description: "Fresh evidence directory path with an existing parent." }),
      timeout: Type.Optional(Type.Number({ exclusiveMinimum: 0, maximum: 2000000, description: "Timeout seconds; default 1800." })),
    }),
    async execute(_id, params, signal, _update, ctx) {
      return controller.execute(params, signal, ctx);
    },
  }));
}

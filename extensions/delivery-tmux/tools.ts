import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { AssignmentParams, EscalationParams, DeveloperParams, ScoutParams } from "./requests.ts";
import type { ExecutionService } from "./execution.ts";

/** Existing model-only tools are clients, not the execution engine. */
export function registerExecutionTools(pi: ExtensionAPI, service: ExecutionService): void {
  service.onReady(definitions => {
    for (const tool of definitions) {
      const description = tool.name === "subagent" ? "Delegate an authorized development task to a builder, validator or reviewer in tmux. A clear execution request supplies authority; no separate mode selection or Agreement ceremony. Use role defaults or supported explicit routing. Workers may run concurrently in distinct linked worktrees; same-workspace ownership is exclusive. Optional assignment binds user-requested cumulative limits; ordinary corrections are not repair tokens. Reconcile terminal state before bounded recovery or escalation; never replay side effects blindly or reset declared limits. No nesting. Results arrive automatically; the lead inspects and accepts." : tool.name === "subagents_list" ? "Inspect the four fixed bundled profiles (Team builder/validator/reviewer and separate read-only Scout). No project/global overrides. Explicit inspection only, not completion polling." : "Control or resume an owned delivery session by exact name. Matching runId/questionId replies release waiting, not pause. Pause preserves the pane; rearm requires new work; stop cancels. Saved resume replays pinned grants. Scout new work requires its original discoveryAuthorityRef. Developer new work requires the original approvalRef and packetRef; replies/pause/stop do not grant new work. Results arrive automatically.";
      const parameters = tool.name === "subagent" ? { ...tool.parameters,
        properties: { ...tool.parameters.properties,
          assignment: Type.Optional(AssignmentParams), escalation: Type.Optional(EscalationParams),
          profile: Type.Optional(Type.Union([Type.Literal("start"), Type.Literal("strong")])),
          thinking: Type.Optional(Type.Union(["none", "off", "minimal", "low", "medium", "high", "xhigh", "max"].map(level => Type.Literal(level)))) },
        additionalProperties: false } : tool.name === "subagent_message" ? { ...tool.parameters,
          properties: { ...tool.parameters.properties, approvalRef: Type.String({ minLength: 1 }), packetRef: Type.String({ minLength: 1 }), discoveryAuthorityRef: Type.String({ minLength: 1 }) },
              additionalProperties: false } : tool.parameters;

      const execute = (id: string, params: any, signal: any, update: any, context: any) => {
        const call = { id, signal, onUpdate: update, context };
        return tool.name === "subagent" ? service.launch({ kind: "worker", params }, call) :
          tool.name === "subagent_message" ? service.control(params, call) : service.profiles(call);
      };
      pi.registerTool({ ...tool, parameters, description, promptSnippet: description,
        exposure: "model-only", executionMode: "parallel", execute });
      if (tool.name === "subagent") {
        const scoutDescription = "Read-only supplied-source discovery. Use a focused question, accessible sources, rules, exclusions, budget and cited result contract. Task authority is a declaration and does not authenticate consent or grant private-data access. Lookup defaults to Luna/low; analysis to Terra/medium; strong routes remain supported. Only granted read/search/codemode tools, no mutation, shell, web or nesting. Shares workspace ownership, not a global worker slot. Results arrive automatically; lead alone accepts. Saved model/tool/resource pins and explicitly declared limits remain binding.";

        pi.registerTool({ name: "scout", label: "Scout", description: scoutDescription,
          promptSnippet: scoutDescription, parameters: ScoutParams,
          exposure: "model-only", executionMode: "parallel",
          execute: (id, params: any, signal, update, context) =>
            service.launch({ kind: "scout", params }, { id, signal, onUpdate: update, context }),
        });
        const developerDescription = "Delegate an authorized task to a fixed builder in tmux. Supply task authority references and a compact text packet or legacy structured packet. No separate Developer selection or Team documents required. Use approved builder routing; optional cwd must be a linked worktree of the current repository. Independent workspaces may run concurrently. Reconcile changes and resources before bounded recovery; no declared-limit reset or blind side-effect replay. Saved pins remain unchanged; the parent inspects and accepts.";

        pi.registerTool({ name: "developer", label: "Developer", description: developerDescription,
          promptSnippet: developerDescription, parameters: DeveloperParams,
          exposure: "model-only", executionMode: "parallel",
          execute: (id, params: any, signal, update, context) =>
            service.launch({ kind: "developer", params }, { id, signal, onUpdate: update, context }),
        });
      }
    }
  });
}

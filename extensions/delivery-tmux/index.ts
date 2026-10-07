import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { realpathSync } from "node:fs";
import { Type } from "typebox";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { SubagentLoadout } from "../../vendor/pi-interactive-subagents/pi-extension/subagents/session.ts";

// Pi's loader retains the installed symlink path. Resolve the source entry
// before locating repo-bundled modules and the worker control extension.
const SOURCE = pathToFileURL(realpathSync(fileURLToPath(import.meta.url)));
const vendorPath = (name: string) => fileURLToPath(new URL(`../../vendor/pi-interactive-subagents/pi-extension/subagents/${name}`, SOURCE));

const CONTROLS = ["subagent", "subagent_message", "subagents_list"] as const;
const ENTRY = "delivery-tmux-owned-v1";
const CAPABILITIES = [...CONTROLS, "developer"];
type Workflow = { kind: "team" } | { kind: "developer"; approvalRef: string; packetRef: string };
const nonempty = (value: unknown): value is string => typeof value === "string" && !!value.trim() && !value.includes("\0");
const isWorkflow = (value: unknown): value is Workflow => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return v.kind === "team" ? Object.keys(v).length === 1 : v.kind === "developer" &&
    Object.keys(v).length === 3 && nonempty(v.approvalRef) && nonempty(v.packetRef);
};
const PACKET_FIELDS = ["purpose", "scope", "allowedPaths", "projectRules", "baseline", "validation", "acceptance", "task"] as const;
const reference = () => Type.String({ minLength: 1 });
const DeveloperParams = Type.Object({
  selection: Type.Literal("Developer"), approvalRef: reference(), packetRef: reference(),
  packet: Type.Object(Object.fromEntries(PACKET_FIELDS.map(key => [key, reference()])), { additionalProperties: false }),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
}, { additionalProperties: false });
const TIMEOUT_MS = 20 * 60 * 1000;
const RESOURCES = { control: pathToFileURL(vendorPath("subagent-done.ts")).href,
  deny: ["extensions", "mcp", "skills", "prompt-templates", "themes", "context-files"] };
type State = "running" | "paused" | "completed" | "cancelled" | "error";
interface Owned {
  version: 1;
  parent: string;
  name: string;
  id: string;
  sessionFile: string;
  loadout: SubagentLoadout;
  state: State;
  resources: typeof RESOURCES;
  /** Absent on accepted v1 records means legacy Team, never Developer. */
  workflow?: Workflow;
}

/** Opt-in current-session lead. No factory resources and no generic entry point. */
export default async function deliveryTmux(pi: ExtensionAPI) {
  const { registerDeliveryRuntime, hasDeliveryRun, cancelDeliveryRun } = await import(vendorPath("index.ts"));
  const { hasOwnedSurfaces } = await import(vendorPath("surface-ownership.ts"));
  const { DELIVERY_TOOLS, isSubagentLoadout, readSubagentLoadout } = await import(vendorPath("session.ts"));
  let context: ExtensionContext | undefined;
  let parent = "";
  let initialized = false;
  let reserved = false;
  let active: string | undefined;
  let failed = false;
  let launchWorkflow: Workflow | undefined;
  const owned = new Map<string, Owned>();
  const knownRuns = new Set<string>();
  const shutdown: Array<(event: any, ctx: ExtensionContext) => unknown> = [];

  const persist = (record: Owned) => {
    try { pi.appendEntry(ENTRY, record); }
    catch (error) { failed = true; throw error; }
    owned.set(record.name, record);
  };
  const identity = (ctx: ExtensionContext) => `${ctx.sessionManager.getSessionId()}:${ctx.sessionManager.getSessionFile()}`;
  const assertContext = (ctx: ExtensionContext) => {
    if (!initialized || failed || identity(ctx) !== parent) throw new Error("Delivery runtime unavailable or ownership reconciliation required; no launch/control permitted");
  };
  const assertPinned = (record: Owned) => {
    const snapshot = readSubagentLoadout(record.sessionFile);
    if (!snapshot || JSON.stringify(snapshot) !== JSON.stringify(record.loadout)) {
      throw new Error("Owned saved loadout missing, changed, or invalid; refusing resume/control");
    }
  };

  pi.on("session_start", (event, ctx) => {
    // Public action APIs are bound here, not in the extension factory. Check
    // before initializing vendor reload/abort/ownership hooks or registering tools.
    if (!initialized) {
      const collisions = pi.getAllTools().filter(tool => CAPABILITIES.includes(tool.name as any));
      if (collisions.length) throw new Error(`Delivery control collision: ${collisions.map(tool => tool.name).join(", ")}; existing runtime left untouched`);
    }
    context = ctx;
    parent = identity(ctx);
    owned.clear(); active = undefined; reserved = false; failed = false;
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "custom" || entry.customType !== ENTRY) continue;
      const record = entry.data as Owned;
      if (!record || record.version !== 1 || record.parent !== parent ||
          typeof record.name !== "string" || !record.name || typeof record.id !== "string" ||
          typeof record.sessionFile !== "string" || !isSubagentLoadout(record.loadout) ||
          !record.loadout.deliveryRole || record.loadout.agent !== record.loadout.deliveryRole ||
          (Object.hasOwn(record, "workflow") && (!isWorkflow(record.workflow) ||
            (record.workflow.kind === "developer" && record.loadout.deliveryRole !== "builder"))) ||
          JSON.stringify(record.resources) !== JSON.stringify(RESOURCES) ||
          !["running", "paused", "completed", "cancelled", "error"].includes(record.state)) {
        failed = true; continue;
      }
      owned.set(record.name, record);
    }
    for (const record of owned.values()) {
      if (record.state === "running" || record.state === "paused") {
        if (active) failed = true;
        active = record.name; // Unknown/crashed workers are never silently adopted/released.
      }
    }
    if (initialized) return;

    const proxy = new Proxy(pi, {
      get(target, key) {
        if (key === "on") return (name: string, handler: any) => {
          if (name === "session_shutdown") { shutdown.push(handler); return () => {}; }
          if (name === "session_start") { handler(event, ctx); return target.on(name, handler); }
          return target.on(name as any, handler);
        };
        if (key === "sendMessage") return (message: any, options: any) => target.sendMessage({
          ...message,
          content: typeof message.content === "string" ? message.content.slice(0, 16000) : message.content,
          details: message.details ? { ...message.details, task: undefined } : undefined,
        }, options);
        if (key === "registerTool") return (tool: any) => {
          if (!CONTROLS.includes(tool.name)) throw new Error("Unexpected delivery control");
          const description = tool.name === "subagent" ? "Team-only: after explicit Team selection and actual Agreement approval, launch one fixed delivery builder, validator, or reviewer in tmux. Model/thinking selection only; no parallel workers or nesting. Results arrive automatically; completion is not acceptance." : tool.name === "subagents_list" ? "Inspect the three fixed bundled delivery roles. No project/global overrides. Explicit inspection only, not completion polling." : "Control or resume an owned delivery session by exact name. Matching runId/questionId replies release waiting, not pause. Pause preserves the pane; rearm requires new work; stop cancels. Saved resume replays pinned grants. Developer new work requires the original approvalRef and packetRef; replies/pause/stop do not grant new work. Results arrive automatically.";
          const parameters = tool.name === "subagent" ? { ...tool.parameters,
            properties: Object.fromEntries(Object.entries(tool.parameters.properties).filter(([name]) => name !== "cwd")),
            additionalProperties: false } : tool.name === "subagent_message" ? { ...tool.parameters,
              properties: { ...tool.parameters.properties, approvalRef: reference(), packetRef: reference() },
              additionalProperties: false } : tool.parameters;
          const execute = async (id: string, params: any, signal: any, update: any, callCtx: ExtensionContext, workflow?: Workflow) => {
              assertContext(callCtx);
              const launch = tool.name === "subagent";
              const control = tool.name === "subagent_message";
              let takingSlot = launch;
              let record: Owned | undefined;
              if (launch) {
                if (!Object.hasOwn(DELIVERY_TOOLS, params.agent) || Object.keys(params).some(key => !["agent", "task", "name", "model", "thinking"].includes(key))) throw new Error("Only fixed delivery roles and model/thinking selection are permitted");
                if (params.name && owned.has(params.name.trim())) throw new Error("Delivery name already owned; use owned resume");
                if (params.name && (!params.name.trim() || params.name.length > 80)) throw new Error("Delivery name must be nonempty and bounded to 80 characters");
                params = { ...params, name: params.name?.trim(), cwd: callCtx.cwd,
                  model: params.model ?? (callCtx.model ? `${callCtx.model.provider}/${callCtx.model.id}` : undefined),
                  thinking: params.thinking ?? pi.getThinkingLevel() };
                if (!params.model) throw new Error("An explicit or current-session model is required");
              }
              if (control) {
                if (Object.keys(params).some(key => !["name", "message", "runId", "questionId", "action", "approvalRef", "packetRef"].includes(key))) throw new Error("Only owned delivery control fields are permitted");
                // A correlated answer releases waiting, never interruption. Reject
                // ambiguous reply/rearm before touching either worker's state.
                const correlated = Object.hasOwn(params, "runId") || Object.hasOwn(params, "questionId");
                if (params.action === "rearm" && correlated) throw new Error("Correlated reply and rearm must be separate requests");
                // Presence cannot exempt ordinary work from its authority checks.
                // Validate before transport, saved resume, or any slot/state mutation;
                // the fixed runtime still checks exact pending run/question IDs.
                if (correlated && (!Object.hasOwn(params, "runId") || !Object.hasOwn(params, "questionId") ||
                    !nonempty(params.runId) || !nonempty(params.questionId))) {
                  throw new Error("Correlation requires both nonempty runId and questionId strings; malformed replies refused");
                }
                record = owned.get(params.name?.trim());
                if (!record || record.parent !== parent) throw new Error("Target is not owned by this delivery session; registry adoption refused");
                assertPinned(record);
                const newWork = params.action !== "pause" && params.action !== "stop" && !correlated;
                if (record.workflow?.kind === "developer" && newWork &&
                    (params.approvalRef !== record.workflow.approvalRef || params.packetRef !== record.workflow.packetRef)) {
                  throw new Error("Developer new work requires original approved packet and approval references; no Team authority substitution");
                }
                if (record.workflow?.kind !== "developer" &&
                    (Object.hasOwn(params, "approvalRef") || Object.hasOwn(params, "packetRef"))) {
                  throw new Error("Developer authority cannot convert legacy/Team ownership");
                }
                const live = hasDeliveryRun(record.name, record.id);
                takingSlot = !live;
                if (!live && record.state === "paused" && params.action === "stop") {
                  cancelDeliveryRun(record.name, record.id, "explicit stop of preserved paused pane");
                  if (owned.get(record.name)?.state !== "cancelled") throw new Error("Paused ownership unresolved; shutdown reconciliation required");
                  return { content: [{ type: "text", text: "Preserved paused worker cancelled." }], details: { status: "cancelled", name: record.name } };
                }
                if (takingSlot && (record.state === "running" || record.state === "paused")) throw new Error("Owned worker is unresolved/paused without a live watcher; reconcile shutdown before saved resume");
              }
              if (takingSlot) {
                if (reserved || active) throw new Error("One delivery worker already active/reserved (paused and waiting hold the slot)");
                if (hasOwnedSurfaces()) throw new Error("Owned pane cleanup unresolved; refusing another worker until teardown succeeds");
                reserved = true; // Synchronous, before the first await, including sibling calls.
                launchWorkflow = workflow ?? record?.workflow ?? { kind: "team" };
              }
              try {
                const result = await tool.execute(id, params, signal, update, callCtx);
                if (control && record && !result.details?.error) {
                  if (params.action === "pause") persist({ ...record, state: "paused" });
                  else if (params.action === "rearm" && !takingSlot) persist({ ...record, state: "running" });
                }
                if (result.details?.error) throw new Error(result.details.error);
                return result;
              } catch (error) {
                if (takingSlot && active) {
                  const launched = owned.get(active);
                  if (launched && !hasDeliveryRun(launched.name, launched.id)) {
                    persist({ ...launched, state: "cancelled" }); active = undefined;
                  }
                }
                throw error;
              } finally { if (takingSlot) { reserved = false; launchWorkflow = undefined; } }
          };
          target.registerTool({ ...tool, parameters, description, promptSnippet: description,
            exposure: "model-only", executionMode: "sequential", execute });
          if (tool.name === "subagent") {
            const developerDescription = "Only after explicit user Developer selection and compact task approval, launch ONE fixed builder in tmux. Supply approval/packet references and full purpose, scope/allowed paths, project rules, baseline, validation and acceptance. References are instruction-based declarations, not authentication of user consent. No Team documents required; no role/cwd/tool/CLI overrides. Current model/thinking retained. Shares Team's owned slot; results arrive automatically. Parent inspects changes/evidence and alone accepts; completion is not acceptance. Control through subagent_message.";
            target.registerTool({ name: "developer", label: "Developer", description: developerDescription,
              promptSnippet: developerDescription, parameters: DeveloperParams,
              exposure: "model-only", executionMode: "sequential",
              async execute(id, params: any, signal, update, callCtx) {
                if (!params || Object.keys(params).some(key => !["selection", "approvalRef", "packetRef", "packet", "name"].includes(key)) ||
                    params.selection !== "Developer" || !nonempty(params.approvalRef) || !nonempty(params.packetRef) ||
                    !params.packet || typeof params.packet !== "object" || Array.isArray(params.packet) ||
                    Object.keys(params.packet).length !== PACKET_FIELDS.length ||
                    !PACKET_FIELDS.every(key => nonempty(params.packet[key]))) {
                  throw new Error("Developer requires explicit selection, approval/packet references and a complete bounded packet; no overrides");
                }
                const workflow: Workflow = { kind: "developer", approvalRef: params.approvalRef, packetRef: params.packetRef };
                const task = `Standalone Developer: implement only this approved compact packet. No Team artifact set is required. Parent alone inspects and accepts. Approval metadata is not authenticated user consent.\nApproval: ${params.approvalRef}\nPacket revision: ${params.packetRef}\n` +
                  PACKET_FIELDS.map(key => `\n## ${key}\n${params.packet[key]}`).join("\n");
                return execute(id, { agent: "builder", name: params.name, task }, signal, update, callCtx, workflow);
              },
            });
          }
        };
        return Reflect.get(target, key);
      },
    });
    registerDeliveryRuntime(proxy, {
      timeoutMs: TIMEOUT_MS,
      onLaunch(record) {
        if (!context || !reserved) throw new Error("Unreserved delivery launch refused");
        const next: Owned = { ...record, version: 1, parent, state: "running", resources: RESOURCES,
          workflow: launchWorkflow ?? { kind: "team" } };
        persist(next); knownRuns.add(record.id); active = record.name;
      },
      onTerminal(name, id, state) {
        const record = owned.get(name);
        if (!record || record.id !== id) { failed = true; return; }
        if (state !== "paused") active = undefined;
        try { persist({ ...record, state }); } catch { /* Fail closed until reconciliation. */ }
      },
      resolveSession(name) {
        const record = owned.get(name);
        if (!record) return undefined;
        assertPinned(record);
        return { sessionFile: record.sessionFile, sessionId: null };
      },
    });
    initialized = true;
  });

  pi.on("session_shutdown", async (event, ctx) => {
    if (!initialized) return;
    // Intent before I/O; isolate failures so every owned cleanup gets a chance.
    const errors: unknown[] = [];
    for (const record of owned.values()) if (record.state === "running" || record.state === "paused") {
      if (!knownRuns.has(record.id)) { errors.push(new Error("Saved active worker ownership unresolved; cannot prove teardown")); continue; }
      try { cancelDeliveryRun(record.name, record.id, "parent teardown"); } catch (error) { errors.push(error); }
    }
    for (const handler of shutdown) {
      try { await handler(event, ctx); } catch (error) { errors.push(error); }
    }
    if (!errors.length) {
      for (const record of owned.values()) if (record.state === "running" || record.state === "paused") {
        try { persist({ ...record, state: "cancelled" }); } catch (error) { errors.push(error); }
      }
    }
    if (errors.length) { failed = true; throw new AggregateError(errors, "Delivery teardown incomplete; ownership retained for reconciliation"); }
    active = undefined; reserved = false;
  });
}

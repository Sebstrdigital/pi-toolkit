import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DispatchQueue, resolveWorkerWorkspace } from "./workspace.ts";
import { resolveRoleRoute } from "./role-routing.ts";
import { chargeExecution, isExecutionRecord, remainingExecutionMs } from "./allowance.ts";
import { realpathSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { SubagentLoadout } from "../../vendor/pi-interactive-subagents/pi-extension/subagents/session.ts";
import { prepareLaunch, validateControl, nonempty, exactKeys, isWorkflow, isAssignment, isEscalation,
  type Workflow, type Assignment, type Escalation, type Lineage,
  type LaunchRequest, type ControlRequest } from "./requests.ts";

// Pi's loader retains the installed symlink path. Resolve the source entry
// before locating repo-bundled modules and the worker control extension.
const SOURCE = pathToFileURL(realpathSync(fileURLToPath(import.meta.url)));
const vendorPath = (name: string) => fileURLToPath(new URL(`../../vendor/pi-interactive-subagents/pi-extension/subagents/${name}`, SOURCE));

export type { LaunchRequest, ControlRequest } from "./requests.ts";

export interface ExecutionCall {
  id: string;
  context: ExtensionContext;
  signal?: AbortSignal;
  onUpdate?: Parameters<Tool["execute"]>[3];
}
type Tool = Parameters<ExtensionAPI["registerTool"]>[0];
export type ControlDefinition = Omit<Tool, "execute">;
export type ExecutionResult = Awaited<ReturnType<Tool["execute"]>>;
export type ExecutionEvent =
  | { type: "message"; message: any }
  | { type: "launch"; name: string; runId: string }
  | { type: "terminal"; name: string; runId: string; state: State }
  | { type: "execution-time"; name: string; runId: string; elapsedMs: number };
export interface ExecutionService {
  launch(request: LaunchRequest, call: ExecutionCall): Promise<ExecutionResult>;
  control(request: ControlRequest, call: ExecutionCall): Promise<ExecutionResult>;
  profiles(call: ExecutionCall): Promise<ExecutionResult>;
  inspect(context: ExtensionContext): ReadonlyArray<{ name: string; runId: string; state: State; role: string; cwd: string | null; model: string | null; thinking: string | null }>;
  onReady(listener: (definitions: readonly ControlDefinition[]) => void): () => void;
  onEvent(listener: (event: ExecutionEvent) => void | Promise<void>): () => void;
}
// The installed symlink and canonical source can be loaded as separate modules.
// Share only within this exact source and host API, never with upstream runtimes.
const SERVICES_KEY = Symbol.for("pi-toolkit/execution-services:" + SOURCE.href);
const services: WeakMap<ExtensionAPI, Promise<ExecutionService>> =
  (globalThis as any)[SERVICES_KEY] ??= new WeakMap();

/** One guarded service per host adapter. Construction starts no worker resources. */
export function createExecutionService(pi: ExtensionAPI): Promise<ExecutionService> {
  const existing = services.get(pi);
  if (existing) return existing;
  const service = createService(pi);
  services.set(pi, service);
  return service;
}

const CONTROLS = ["subagent", "subagent_message", "subagents_list"] as const;
const ENTRY = "delivery-tmux-owned-v1";
const LINEAGE_ENTRY = "delivery-tmux-lineage-v1";
const CAPABILITIES = [...CONTROLS, "developer", "scout"];
const TEAM_ROLES = ["builder", "validator", "reviewer"] as const;
const LEGACY_TIMEOUT_MS = 20 * 60 * 1000;
const LEGACY_RESOURCES = { control: pathToFileURL(vendorPath("subagent-done.ts")).href,
  deny: ["extensions", "mcp", "skills", "prompt-templates", "themes", "context-files"] };
const RESOURCES = { control: LEGACY_RESOURCES.control, deny: ["extensions", "mcp"] };
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
  /** Absent on accepted v1 records means legacy Team, never Developer or Scout. */
  workflow?: Workflow;
  assignmentRoot?: string;
  /** Cumulative execution elapsed for this name and the current run respectively. */
  executionMs?: number;
  runExecutionMs?: number;
}

/** Pi/tmux-backed execution; engineering lifecycle decisions belong to callers. */
async function createService(pi: ExtensionAPI): Promise<ExecutionService> {
  const { registerDeliveryRuntime, hasDeliveryRun, cancelDeliveryRun } = await import(vendorPath("index.ts"));
  const { hasUnreconciledSurfaces } = await import(vendorPath("surface-ownership.ts"));
  const { DELIVERY_TOOLS, isSubagentLoadout, readSubagentLoadout } = await import(vendorPath("session.ts"));
  let context: ExtensionContext | undefined;
  let parent = "";
  let initialized = false;
  let closed = true;
  let reserved = false;
  const active = new Set<string>();
  const dispatch = new DispatchQueue();
  let launchTimeout = Infinity;
  let failed = false;
  let launchWorkflow: Workflow | undefined;
  let launchRoot: string | undefined;
  const lineages = new Map<string, Lineage>();
  const persistLineage = (lineage: Lineage) => {
    try { pi.appendEntry(LINEAGE_ENTRY, lineage); }
    catch (error) { failed = true; throw error; }
    lineages.set(lineage.assignment.id, lineage);
  };
  const owned = new Map<string, Owned>();
  const remaining = (lineage: Lineage) => {
    const replacement = lineage.consumed && lineage.handoff!.remainingEffortMinutes !== undefined ? {
      name: lineage.replacementName!, remainingEffortMinutes: lineage.handoff!.remainingEffortMinutes,
    } : undefined;
    if (lineage.assignment.effortMinutes === undefined) {
      return replacement ? remainingExecutionMs(lineage.assignment.id, replacement.remainingEffortMinutes,
        [...owned.values()].filter(record => record.name === replacement.name)) : Infinity;
    }
    return remainingExecutionMs(lineage.assignment.id, lineage.assignment.effortMinutes, owned.values(), replacement);
  };
  const knownRuns = new Set<string>();
  const shutdown: Array<(event: any, ctx: ExtensionContext) => unknown> = [];

  const persist = (record: Owned) => {
    try { pi.appendEntry(ENTRY, record); }
    catch (error) { failed = true; throw error; }
    owned.set(record.name, record);
  };
  const identity = (ctx: ExtensionContext) => `${ctx.sessionManager.getSessionId()}:${ctx.sessionManager.getSessionFile()}`;
  const assertContext = (ctx: ExtensionContext) => {
    if (!initialized || closed || failed || identity(ctx) !== parent) throw new Error("Delivery runtime unavailable or ownership reconciliation required; no launch/control permitted");
  };
  const assertPinned = (record: Owned) => {
    const snapshot = readSubagentLoadout(record.sessionFile);
    if (!snapshot || JSON.stringify(snapshot) !== JSON.stringify(record.loadout)) {
      throw new Error("Owned saved loadout missing, changed, or invalid; refusing resume/control");
    }
  };

  const executors = new Map<string, (...args: any[]) => Promise<any>>();
  const definitions: ControlDefinition[] = [];
  const readyListeners = new Set<(definitions: readonly ControlDefinition[]) => void>();
  const eventListeners = new Set<(event: ExecutionEvent) => void | Promise<void>>();
  const emit = (event: ExecutionEvent) => {
    for (const listener of [...eventListeners]) {
      // Observers cannot corrupt transport/ownership, or change another observer's data.
      try {
        Promise.resolve(listener(structuredClone(event))).catch(error => console.error("Execution observer failed:", error));
      } catch (error) { console.error("Execution observer failed:", error); }
    }
  };
  const invoke = (operation: string, call: ExecutionCall, params: any, workflow?: Workflow, authority?: string) => {
    assertContext(call.context);
    const execute = executors.get(operation);
    if (!execute) throw new Error("Execution runtime not ready");
    return execute(call.id, params, call.signal, call.onUpdate, call.context, workflow, authority);
  };
  const service: ExecutionService = {
    async launch(request, call) {
      assertContext(call.context);
      const prepared = prepareLaunch(structuredClone(request), call.context.cwd);
      return invoke("subagent", call, prepared.params, prepared.workflow, prepared.authority);
    },
    async control(request, call) {
      assertContext(call.context);
      const params = structuredClone(request);
      validateControl(params);
      return invoke("subagent_message", call, params);
    },
    async profiles(call) { return invoke("subagents_list", call, {}); },
    inspect(ctx) {
      assertContext(ctx);
      return [...owned.values()].map(record => ({
        name: record.name, runId: record.id, state: record.state, role: record.loadout.deliveryRole!,
        cwd: record.loadout.cwd, model: record.loadout.model, thinking: record.loadout.thinking,
      }));
    },
    onReady(listener) {
      if (initialized) listener([...definitions]);
      readyListeners.add(listener);
      return () => { readyListeners.delete(listener); };
    },
    onEvent(listener) {
      eventListeners.add(listener);
      return () => { eventListeners.delete(listener); };
    },
  };

  pi.on("session_start", (event, ctx) => {
    // Public action APIs are bound here, not in the extension factory. Check
    // before initializing vendor reload/abort/ownership hooks or registering tools.
    if (!initialized) {
      const collisions = pi.getAllTools().filter(tool => CAPABILITIES.includes(tool.name as any));
      if (collisions.length) throw new Error(`Delivery control collision: ${collisions.map(tool => tool.name).join(", ")}; existing runtime left untouched`);
    }
    closed = false;
    context = ctx;
    parent = identity(ctx);
    owned.clear(); lineages.clear(); active.clear(); reserved = false; failed = false;
    // Consumption is resource authority, not branch-sensitive conversation state.
    // Read only this parent session, including abandoned branches; never scan sessions.
    for (const entry of ctx.sessionManager.getEntries?.() ?? []) {
      if (entry.type !== "custom" || entry.customType !== LINEAGE_ENTRY) continue;
      const l = entry.data as Lineage;
      const previous = l?.assignment && lineages.get(l.assignment.id);
      if (!l || !exactKeys(l, ["version", "parent", "rootName", "role", "workflow", "assignment", "authority", "consumed", ...(l.consumed ? ["replacementName", "handoff"] : [])]) ||
          l.version !== 1 || l.parent !== parent || !isAssignment(l.assignment) || !isWorkflow(l.workflow) ||
          !nonempty(l.rootName) || !nonempty(l.authority) || !Object.hasOwn(DELIVERY_TOOLS, l.role) ||
          (l.workflow.kind === "developer" && (l.role !== "builder" || l.assignment.approvalRef !== l.workflow.approvalRef || l.assignment.packetRef !== l.workflow.packetRef)) ||
          (l.workflow.kind === "scout" && (l.role !== "scout" || l.assignment.approvalRef !== l.workflow.discoveryAuthorityRef || l.assignment.packetRef !== l.workflow.discoveryAuthorityRef)) ||
          ((l.role === "scout") !== (l.workflow.kind === "scout")) ||
          typeof l.consumed !== "boolean" || (l.consumed && (!nonempty(l.replacementName) || l.replacementName === l.rootName || !isEscalation(l.handoff) ||
            l.handoff.from !== l.rootName || (l.assignment.effortMinutes !== undefined &&
              (l.handoff.remainingEffortMinutes === undefined || l.handoff.remainingEffortMinutes > l.assignment.effortMinutes)) ||
            (l.assignment.repairAttempts !== undefined && (l.assignment.repairAttempts < 1 || l.handoff.remainingRepairAttempts === undefined || l.handoff.remainingRepairAttempts > l.assignment.repairAttempts - 1)))) ||
          (!l.consumed && (Object.hasOwn(l, "replacementName") || Object.hasOwn(l, "handoff"))) ||
          (previous && (previous.consumed || JSON.stringify({...previous, consumed: true, replacementName: l.replacementName, handoff: l.handoff}) !== JSON.stringify(l)))) {
        failed = true; continue;
      }
      lineages.set(l.assignment.id, l);
    }
    const boundNames = new Set([...lineages.values()].flatMap(l => [l.rootName, l.replacementName].filter(nonempty)));
    const isBoundOwned = (entry: any) => entry.type === "custom" && entry.customType === ENTRY &&
      (Object.hasOwn(entry.data ?? {}, "assignmentRoot") || boundNames.has(entry.data?.name));
    // Declared assignments are resource authority across this parent's branches.
    // Legacy/unbound ownership retains the accepted branch-scoped behavior.
    const ownershipEntries = [
      ...ctx.sessionManager.getBranch().filter(entry => !isBoundOwned(entry)),
      ...(ctx.sessionManager.getEntries?.() ?? []).filter(isBoundOwned),
    ];
    for (const entry of ownershipEntries) {
      if (entry.type !== "custom" || entry.customType !== ENTRY) continue;
      const record = entry.data as Owned;
      if (!record || record.version !== 1 || record.parent !== parent ||
          typeof record.name !== "string" || !record.name || typeof record.id !== "string" ||
          typeof record.sessionFile !== "string" || !isSubagentLoadout(record.loadout) ||
          !record.loadout.deliveryRole || record.loadout.agent !== record.loadout.deliveryRole ||
          (Object.hasOwn(record, "workflow") && (!isWorkflow(record.workflow) ||
            (record.workflow.kind === "developer" && record.loadout.deliveryRole !== "builder") ||
            (record.workflow.kind === "scout" && record.loadout.deliveryRole !== "scout"))) ||
          ([...lineages.values()].some(l => [l.rootName, l.replacementName].includes(record.name) && record.assignmentRoot !== l.assignment.id)) ||
          (Object.hasOwn(record, "assignmentRoot") && (!nonempty(record.assignmentRoot) ||
            !lineages.has(record.assignmentRoot) ||
            ![lineages.get(record.assignmentRoot)?.rootName, lineages.get(record.assignmentRoot)?.replacementName].includes(record.name) ||
            lineages.get(record.assignmentRoot)?.role !== record.loadout.deliveryRole ||
            JSON.stringify(lineages.get(record.assignmentRoot)?.workflow) !== JSON.stringify(record.workflow))) ||
          ((record.loadout.deliveryRole === "scout") !== (record.workflow?.kind === "scout")) ||
          ((Object.hasOwn(record, "executionMs") || Object.hasOwn(record, "runExecutionMs")) &&
            (!isExecutionRecord(record) || record.executionMs! < (owned.get(record.name)?.executionMs ?? 0) ||
              (record.id === owned.get(record.name)?.id && record.runExecutionMs! < (owned.get(record.name)?.runExecutionMs ?? 0)))) ||
          (owned.get(record.name)?.executionMs !== undefined && record.executionMs === undefined) ||
          JSON.stringify(record.resources) !== JSON.stringify(record.loadout.resourcePolicy === "project-context" ? RESOURCES : LEGACY_RESOURCES) ||
          !["running", "paused", "completed", "cancelled", "error"].includes(record.state)) {
        failed = true; continue;
      }
      owned.set(record.name, record);
    }
    for (const record of owned.values()) {
      if (record.state === "running" || record.state === "paused") {
        try {
          const workspace = realpathSync(record.loadout.cwd!);
          if ([...active].some(name => realpathSync(owned.get(name)!.loadout.cwd!) === workspace)) failed = true;
        } catch { failed = true; } // Missing saved workspace cannot prove exclusive ownership.
        active.add(record.name); // Unknown/crashed workers are never silently adopted/released.
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
        if (key === "sendMessage") return (message: any, options: any) => {
          const bounded = {
            ...message,
            content: typeof message.content === "string" ? message.content.slice(0, 16000) : message.content,
            details: message.details ? { ...message.details, task: undefined } : undefined,
          };
          const result = target.sendMessage(bounded, options);
          emit({ type: "message", message: bounded });
          return result;
        };
        if (key === "registerTool") return (tool: any) => {
          if (!CONTROLS.includes(tool.name)) throw new Error("Unexpected delivery control");
          const execute = async (id: string, params: any, signal: any, update: any, callCtx: ExtensionContext, workflow?: Workflow, authority = "") => {
            const release = await dispatch.acquire();
            try { return await executeOwned(id, params, signal, update, callCtx, workflow, authority); }
            finally { release(); }
          };
          const executeOwned = async (id: string, params: any, signal: any, update: any, callCtx: ExtensionContext, workflow?: Workflow, authority = "") => {
              assertContext(callCtx);
              const launch = tool.name === "subagent";
              const control = tool.name === "subagent_message";
              let takingSlot = launch;
              let record: Owned | undefined;
              let nextLineage: Lineage | undefined;
              if (launch) {
                if (!(workflow?.kind === "scout" ? params.agent === "scout" : TEAM_ROLES.includes(params.agent)) || !Object.hasOwn(DELIVERY_TOOLS, params.agent) || Object.keys(params).some(key => !["agent", "task", "name", "model", "thinking", "profile", "taskKind", "assignment", "escalation", "cwd"].includes(key))) throw new Error("Only fixed delivery roles and model/thinking selection are permitted");
                if (params.name && owned.has(params.name.trim())) throw new Error("Delivery name already owned; use owned resume");
                if (params.name && (!params.name.trim() || params.name.length > 80)) throw new Error("Delivery name must be nonempty and bounded to 80 characters");
                const route = resolveRoleRoute(params.agent, params, callCtx.modelRegistry, workflow?.kind === "developer" || workflow?.kind === "scout");
                if (params.assignment !== undefined || params.escalation !== undefined) {
                  if (typeof callCtx.sessionManager.getEntries !== "function" || !isAssignment(params.assignment) || !nonempty(params.name)) throw new Error("Declared assignment requires complete binding, fresh name and durable session entries");
                  const binding = params.assignment as Assignment;
                  const wf = workflow ?? { kind: "team" };
                  if ((wf.kind === "developer" && (binding.approvalRef !== wf.approvalRef || binding.packetRef !== wf.packetRef)) ||
                      (wf.kind === "scout" && (binding.approvalRef !== wf.discoveryAuthorityRef || binding.packetRef !== wf.discoveryAuthorityRef))) throw new Error("Assignment must retain original workflow authority references");
                  // Developer/Scout retain immutable scope-bearing packet fields.
                  // Team records original task authority and scope refs, not another approval ceremony.
                  authority = authority || binding.scopeRef;
                  const root = lineages.get(binding.id);
                  if (params.escalation === undefined) {
                    if (root) throw new Error("Assignment already declared; no fresh replay or budget reset");
                    nextLineage = { version: 1, parent, rootName: params.name.trim(), role: params.agent, workflow: wf, assignment: binding, authority, consumed: false };
                  } else {
                    const h = params.escalation as Escalation;
                    if (!isEscalation(h) || !root || root.consumed) throw new Error("Escalation requires declared provenance and one unconsumed root");
                    const original = owned.get(h.from);
                    if (!original || original.parent !== parent || original.assignmentRoot !== binding.id ||
                        original.name !== root.rootName || original.id !== h.runId ||
                        original.loadout.deliveryRole !== params.agent || root.role !== params.agent ||
                        JSON.stringify(root.assignment) !== JSON.stringify(binding) ||
                        JSON.stringify(root.workflow) !== JSON.stringify(wf) || root.authority !== authority) throw new Error("Escalation role, scope, parent, run or original approved references changed");
                    assertPinned(original);
                    if (original.state !== h.terminalState || hasDeliveryRun(original.name, original.id) ||
                        !["completed", "cancelled", "error"].includes(original.state)) throw new Error("Escalation requires reconciled terminal worker; active/waiting/paused refused");
                    if ((binding.effortMinutes !== undefined && h.remainingEffortMinutes === undefined) ||
                        (h.remainingEffortMinutes !== undefined && h.remainingEffortMinutes * 60000 > remaining(root)) || (binding.repairAttempts !== undefined && (binding.repairAttempts < 1 || h.remainingRepairAttempts === undefined ||
                        h.remainingRepairAttempts > binding.repairAttempts - 1))) throw new Error("Escalation cannot reset or exceed remaining effort/repair allowance");
                    for (const source of h.partialSources) {
                      const actual = createHash("sha256").update(readFileSync(resolve(callCtx.cwd, source.path))).digest("hex");
                      if (actual !== source.sha256) throw new Error("Escalation partial source identity changed: " + source.path);
                    }
                    nextLineage = { ...root, consumed: true, replacementName: params.name.trim(), handoff: h };
                  }
                }
                const { profile, taskKind, assignment, escalation, ...launchParams } = params;
                if (nextLineage) launchParams.task += "\\nDeclared assignment (no budget reset): " + JSON.stringify(nextLineage);
                params = { ...launchParams, name: params.name?.trim(), cwd: resolveWorkerWorkspace(callCtx.cwd, params.cwd), ...route };
              }
              if (control) {
                if (Object.keys(params).some(key => !["name", "message", "runId", "questionId", "action", "approvalRef", "packetRef", "discoveryAuthorityRef"].includes(key))) throw new Error("Only owned delivery control fields are permitted");
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
                if (newWork && record.assignmentRoot && lineages.get(record.assignmentRoot)?.consumed &&
                    lineages.get(record.assignmentRoot)?.replacementName !== record.name) throw new Error("Consumed assignment root cannot resume new work; use its pinned replacement");
                if (record.workflow?.kind === "developer" && newWork &&
                    (params.approvalRef !== record.workflow.approvalRef || params.packetRef !== record.workflow.packetRef)) {
                  throw new Error("Developer new work requires original approved packet and approval references; no Team authority substitution");
                }
                if (record.workflow?.kind === "scout" && newWork &&
                    params.discoveryAuthorityRef !== record.workflow.discoveryAuthorityRef) {
                  throw new Error("Scout new work requires original discovery authority reference; no Team/Developer substitution");
                }
                if (record.workflow?.kind !== "scout" && Object.hasOwn(params, "discoveryAuthorityRef")) {
                  throw new Error("Scout authority cannot convert legacy/Team/Developer ownership");
                }
                const lineage = record.assignmentRoot && lineages.get(record.assignmentRoot);
                if (lineage && record.workflow?.kind === "team" && newWork &&
                    (params.approvalRef !== lineage.assignment.approvalRef || params.packetRef !== lineage.assignment.packetRef)) {
                  throw new Error("Declared Team new work requires original approved assignment references");
                }
                if (record.workflow?.kind !== "developer" && !(lineage && record.workflow?.kind === "team") &&
                    (Object.hasOwn(params, "approvalRef") || Object.hasOwn(params, "packetRef"))) {
                  throw new Error("Developer authority cannot convert legacy/Team ownership");
                }
                if (lineage && newWork) remaining(lineage);
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
                const workspace = realpathSync(launch ? params.cwd : record!.loadout.cwd!);
                if (reserved || [...active].some(name => realpathSync(owned.get(name)!.loadout.cwd!) === workspace)) throw new Error("Worker already active in this workspace (paused and waiting retain ownership)");
                const activeRuns = new Set([...active].map(name => owned.get(name)!.id));
                if (hasUnreconciledSurfaces(activeRuns)) throw new Error("Owned pane cleanup unresolved; refusing another worker until teardown succeeds");
                launchTimeout = record && record.loadout.resourcePolicy !== "project-context" ? LEGACY_TIMEOUT_MS : Infinity;
                // Persist reservation/consumption BEFORE runtime allocation. Never roll
                // it back on transport, persistence, teardown or provider failure.
                if (nextLineage) persistLineage(nextLineage);
                launchRoot = nextLineage?.assignment.id ?? record?.assignmentRoot;
                reserved = true; // Synchronous, before the first await, including sibling calls.
                launchWorkflow = workflow ?? record?.workflow ?? { kind: "team" };
              }
              try {
                const result = await tool.execute(id, params, signal, update, callCtx);
                if (control && record && !takingSlot && !result.details?.error) {
                  // Runtime control may have persisted an execution checkpoint.
                  // Never overwrite it with the pre-call ownership snapshot.
                  const current = owned.get(record.name);
                  if (!current || current.id !== record.id) throw new Error("Owned control run changed during transport");
                  if (params.action === "pause") persist({ ...current, state: "paused" });
                  else if (params.action === "rearm") persist({ ...current, state: "running" });
                }
                if (result.details?.error) throw new Error(result.details.error);
                return result;
              } catch (error) {
                if (takingSlot) {
                  const launched = owned.get(params.name);
                  if (launched && launched.id !== record?.id && !hasDeliveryRun(launched.name, launched.id)) {
                    persist({ ...launched, state: "cancelled" }); active.delete(launched.name);
                  }
                }
                throw error;
              } finally { if (takingSlot) { reserved = false; launchWorkflow = undefined; launchRoot = undefined; } }
          };
          executors.set(tool.name, execute);
          const { execute: _execute, ...definition } = tool;
          definitions.push(definition);
        };
        return Reflect.get(target, key);
      },
    });
    registerDeliveryRuntime(proxy, {
      get timeoutMs() {
        const lineage = launchRoot && lineages.get(launchRoot);
        return lineage ? remaining(lineage) : launchTimeout;
      },
      onLaunch(record) {
        if (!context || !reserved) throw new Error("Unreserved delivery launch refused");
        const previous = owned.get(record.name);
        const next: Owned = { ...record, version: 1, parent, state: "running", resources: record.loadout.resourcePolicy === "project-context" ? RESOURCES : LEGACY_RESOURCES,
          executionMs: previous?.executionMs ?? 0, runExecutionMs: 0,
          workflow: launchWorkflow ?? { kind: "team" }, ...(launchRoot ? { assignmentRoot: launchRoot } : {}) };
        persist(next); knownRuns.add(record.id); active.add(record.name);
        emit({ type: "launch", name: record.name, runId: record.id });
      },
      onExecutionTime(name, id, elapsedMs) {
        const record = owned.get(name);
        if (!record || record.id !== id) { failed = true; throw new Error("Execution checkpoint is not the owned run"); }
        try { persist(chargeExecution(record, elapsedMs)); emit({ type: "execution-time", name, runId: id, elapsedMs }); }
        catch (error) { failed = true; throw error; }
      },
      onTerminal(name, id, state) {
        const record = owned.get(name);
        if (!record || record.id !== id) { failed = true; return; }
        if (state !== "paused") active.delete(name);
        try { persist({ ...record, state }); emit({ type: "terminal", name, runId: id, state }); } catch { /* Fail closed until reconciliation. */ }
      },
      resolveSession(name) {
        const record = owned.get(name);
        if (!record) return undefined;
        assertPinned(record);
        return { sessionFile: record.sessionFile, sessionId: null };
      },
    });
    initialized = true;
    try { for (const listener of readyListeners) listener([...definitions]); }
    catch (error) { failed = true; throw error; }
  });

  pi.on("session_shutdown", async (event, ctx) => {
    if (!initialized) return;
    closed = true;
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
    active.clear(); reserved = false;
  });
  return service;
}

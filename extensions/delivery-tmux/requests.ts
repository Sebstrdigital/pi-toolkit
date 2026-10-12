import { Type } from "typebox";
import { accessSync, constants } from "node:fs";
import { resolve } from "node:path";

/** Compatibility provenance, NOT engineering stages. Persisted tags remain unchanged. */
const TEAM_ROLES = ["builder", "validator", "reviewer"] as const;
export type Workflow = { kind: "team" } | { kind: "developer"; approvalRef: string; packetRef: string } |
  { kind: "scout"; discoveryAuthorityRef: string };
export const nonempty = (value: unknown): value is string => typeof value === "string" && !!value.trim() && !value.includes("\0");
export const isWorkflow = (value: unknown): value is Workflow => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return v.kind === "scout" ? Object.keys(v).length === 2 && nonempty(v.discoveryAuthorityRef) :
    v.kind === "team" ? Object.keys(v).length === 1 : v.kind === "developer" &&
    Object.keys(v).length === 3 && nonempty(v.approvalRef) && nonempty(v.packetRef);
};
const PACKET_FIELDS = ["purpose", "scope", "allowedPaths", "projectRules", "baseline", "validation", "acceptance", "task"] as const;
const reference = () => Type.String({ minLength: 1 });

// Optional declarations bind an assignment before its first launch. They are
// instruction metadata, not authenticated approval or CPU/model-effort measurements.
export const AssignmentParams = Type.Object({
  id: reference(), scopeRef: reference(), approvalRef: reference(), packetRef: reference(),
  effortMinutes: Type.Optional(Type.Number({ exclusiveMinimum: 0 })), repairAttempts: Type.Optional(Type.Integer({ minimum: 0 })),
}, { additionalProperties: false });
export const EscalationParams = Type.Object({
  from: reference(), runId: reference(),
  reason: Type.Union([Type.Literal("reasoning-complexity"), Type.Literal("failed-bounded-repair")]),
  partialSources: Type.Array(Type.Object({ path: reference(), sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }) }, { additionalProperties: false }), { minItems: 1 }),
  findingsRef: reference(), failureEvidenceRef: reference(), remainingCriteria: reference(),
  remainingEffortMinutes: Type.Optional(Type.Number({ exclusiveMinimum: 0 })), remainingRepairAttempts: Type.Optional(Type.Integer({ minimum: 0 })),
  terminalState: Type.Union([Type.Literal("completed"), Type.Literal("cancelled"), Type.Literal("error")]),
  resourcesReleased: Type.Literal(true), resourceEvidenceRef: reference(),
}, { additionalProperties: false });
export type Assignment = { id: string; scopeRef: string; approvalRef: string; packetRef: string; effortMinutes?: number; repairAttempts?: number };
export type Escalation = { from: string; runId: string; reason: string; partialSources: Array<{path: string; sha256: string}>;
  findingsRef: string; failureEvidenceRef: string; remainingCriteria: string; remainingEffortMinutes?: number;
  remainingRepairAttempts?: number; terminalState: "running" | "paused" | "completed" | "cancelled" | "error"; resourcesReleased: true; resourceEvidenceRef: string };
export type Lineage = { version: 1; parent: string; rootName: string; role: string; workflow: Workflow;
  assignment: Assignment; authority: string; consumed: boolean; replacementName?: string; handoff?: Escalation };
export const exactKeys = (v: any, keys: string[]) => v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
export const isAssignment = (v: any): v is Assignment => exactKeys(v, ["id", "scopeRef", "approvalRef", "packetRef", ...(Object.hasOwn(v ?? {}, "effortMinutes") ? ["effortMinutes"] : []), ...(Object.hasOwn(v ?? {}, "repairAttempts") ? ["repairAttempts"] : [])]) &&
  ["id", "scopeRef", "approvalRef", "packetRef"].every(k => nonempty(v[k])) &&
  (!Object.hasOwn(v, "effortMinutes") || (Number.isFinite(v.effortMinutes) && v.effortMinutes > 0 && v.effortMinutes * 60000 <= Number.MAX_SAFE_INTEGER)) &&
  (!Object.hasOwn(v, "repairAttempts") || (Number.isSafeInteger(v.repairAttempts) && v.repairAttempts >= 0));
export const isEscalation = (v: any): v is Escalation => exactKeys(v, ["from", "runId", "reason", "partialSources", "findingsRef", "failureEvidenceRef",
  "remainingCriteria", ...(Object.hasOwn(v ?? {}, "remainingEffortMinutes") ? ["remainingEffortMinutes"] : []), ...(Object.hasOwn(v ?? {}, "remainingRepairAttempts") ? ["remainingRepairAttempts"] : []), "terminalState", "resourcesReleased", "resourceEvidenceRef"]) &&
  ["from", "runId", "findingsRef", "failureEvidenceRef", "remainingCriteria", "resourceEvidenceRef"].every(k => nonempty(v[k])) &&
  ["reasoning-complexity", "failed-bounded-repair"].includes(v.reason) &&
  ["completed", "cancelled", "error"].includes(v.terminalState) && v.resourcesReleased === true &&
  (!Object.hasOwn(v, "remainingEffortMinutes") || (Number.isFinite(v.remainingEffortMinutes) && v.remainingEffortMinutes > 0 && v.remainingEffortMinutes * 60000 <= Number.MAX_SAFE_INTEGER)) &&
  (!Object.hasOwn(v, "remainingRepairAttempts") || (Number.isSafeInteger(v.remainingRepairAttempts) && v.remainingRepairAttempts >= 0)) &&
  Array.isArray(v.partialSources) && v.partialSources.length > 0 && v.partialSources.every((s: any) =>
    exactKeys(s, ["path", "sha256"]) && nonempty(s.path) && typeof s.sha256 === "string" && /^[a-f0-9]{64}$/.test(s.sha256));

export const DeveloperParams = Type.Object({
  selection: Type.Optional(Type.Literal("Developer")), approvalRef: reference(), packetRef: reference(),
  assignment: Type.Optional(AssignmentParams), escalation: Type.Optional(EscalationParams),
  model: Type.Optional(Type.Union([Type.Literal("openai/gpt-5.6-terra"), Type.Literal("openai/gpt-6.1-sol")])),
  thinking: Type.Optional(Type.Union([Type.Literal("medium"), Type.Literal("high")])),
  packet: Type.Union([reference(), Type.Object(Object.fromEntries(PACKET_FIELDS.map(key => [key, reference()])), { additionalProperties: false })]),
  cwd: Type.Optional(reference()),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
}, { additionalProperties: false });
const SCOUT_FIELDS = ["question", "rules", "exclusions", "budget", "resultContract"] as const;
export const ScoutParams = Type.Object({
  assignment: Type.Optional(AssignmentParams), escalation: Type.Optional(EscalationParams),
  discoveryAuthorityRef: reference(),
  taskKind: Type.Optional(Type.Union([Type.Literal("lookup"), Type.Literal("analysis")])),
  profile: Type.Optional(Type.Union([Type.Literal("start"), Type.Literal("strong")])),
  model: Type.Optional(Type.Union(["openai/gpt-6-luna", "openai/gpt-5.6-terra", "openai/gpt-6.1-sol"].map(model => Type.Literal(model)))),
  thinking: Type.Optional(Type.Union(["off", "low", "medium"].map(level => Type.Literal(level)))),
  ...Object.fromEntries(SCOUT_FIELDS.map(key => [key, reference()])),
  sources: Type.Array(reference(), { minItems: 1 }),
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
}, { additionalProperties: false });

export interface WorkerParams {
  agent: "builder" | "validator" | "reviewer";
  task: string;
  name?: string;
  cwd?: string;
  model?: string;
  thinking?: string;
  profile?: "start" | "strong";
  assignment?: Assignment;
  escalation?: Escalation;
}
export interface DeveloperRequestParams {
  approvalRef: string; packetRef: string;
  packet: string | Record<typeof PACKET_FIELDS[number], string>;
  selection?: "Developer"; name?: string; cwd?: string; model?: string; thinking?: string;
  assignment?: Assignment; escalation?: Escalation;
}
export interface ScoutRequestParams {
  discoveryAuthorityRef: string; question: string; rules: string; exclusions: string;
  budget: string; resultContract: string; sources: string[]; name?: string;
  taskKind?: "lookup" | "analysis"; profile?: "start" | "strong"; model?: string; thinking?: string;
  assignment?: Assignment; escalation?: Escalation;
}
export type LaunchRequest =
  | { kind: "worker"; params: WorkerParams }
  | { kind: "developer"; params: DeveloperRequestParams }
  | { kind: "scout"; params: ScoutRequestParams };

export interface ControlRequest {
  name: string; message?: string; runId?: string; questionId?: string;
  action?: "pause" | "stop" | "rearm";
  approvalRef?: string; packetRef?: string; discoveryAuthorityRef?: string;
}

const optionalStrings = (params: any, keys: string[]) => keys.every(key =>
  params[key] === undefined || (typeof params[key] === "string" && !params[key].includes("\0")));

/** Direct callers must pass the same admission rules as model-facing tools. */
export function prepareLaunch(request: LaunchRequest, cwd: string): { params: any; workflow?: Workflow; authority?: string } {
  if (!exactKeys(request, ["kind", "params"]) || !request.params || typeof request.params !== "object" || Array.isArray(request.params)) throw new Error("Invalid execution launch request");
  const params: any = request.params;
  if (request.kind === "worker") {
    if (!TEAM_ROLES.includes(params.agent) || !nonempty(params.task) ||
        Object.keys(params).some(key => !["agent", "task", "name", "cwd", "model", "thinking", "profile", "assignment", "escalation"].includes(key)) ||
        !optionalStrings(params, ["name", "cwd", "model", "thinking"]) ||
        (params.name !== undefined && (!nonempty(params.name) || params.name.length > 80))) throw new Error("Only fixed delivery roles and a nonempty task are permitted");
    return { params: { ...params } };
  }
  if (request.kind === "scout") {
    if (!params || Object.keys(params).some(key => !["discoveryAuthorityRef", ...SCOUT_FIELDS, "sources", "name", "taskKind", "profile", "model", "thinking", "assignment", "escalation"].includes(key)) ||
        !nonempty(params.discoveryAuthorityRef) || !SCOUT_FIELDS.every(key => nonempty(params[key])) ||
        !Array.isArray(params.sources) || !params.sources.length || !params.sources.every(nonempty) ||
        (Object.hasOwn(params, "name") && (!nonempty(params.name) || params.name.length > 80))) {
      throw new Error("Scout requires explicit discovery authority and a complete bounded supplied-source packet; no overrides");
    }
    // Accessibility is a preflight check, not authorization of private data.
    const sources = params.sources.map((path: string) => resolve(cwd, path));
    for (const path of sources) {
      try { accessSync(path, constants.R_OK); }
      catch { throw new Error("Scout supplied source inaccessible: " + path); }
    }
    const task = "Read-only Scout: investigate only this bounded packet. Lead verifies actual permission; metadata is not authenticated consent. No separate mode selection or approval ceremony. No acceptance authority.\nDiscovery authority: " + params.discoveryAuthorityRef +
      "\nSources:\n" + sources.join("\n") +
      SCOUT_FIELDS.map(key => "\n## " + key + "\n" + params[key]).join("\n");
    return { params: { agent: "scout", name: params.name, task, assignment: params.assignment, escalation: params.escalation, taskKind: params.taskKind, profile: params.profile, model: params.model, thinking: params.thinking },
      workflow: { kind: "scout", discoveryAuthorityRef: params.discoveryAuthorityRef },
      authority: JSON.stringify([params.question, sources, params.rules, params.exclusions, params.budget, params.resultContract]) };

  }
  if (request.kind === "developer") {
    if (!params || Object.keys(params).some(key => !["selection", "approvalRef", "packetRef", "packet", "name", "model", "thinking", "assignment", "escalation", "cwd"].includes(key)) ||
        (params.selection !== undefined && params.selection !== "Developer") || !nonempty(params.approvalRef) || !nonempty(params.packetRef) ||
        !(nonempty(params.packet) || (params.packet && typeof params.packet === "object" && !Array.isArray(params.packet) &&
          Object.keys(params.packet).length === PACKET_FIELDS.length && PACKET_FIELDS.every(key => nonempty(params.packet[key])))) ||
        (Object.hasOwn(params, "name") && (!nonempty(params.name) || params.name.length > 80))) {
      throw new Error("Developer requires task authority references and a nonempty compact packet; no overrides");
    }
    const workflow: Workflow = { kind: "developer", approvalRef: params.approvalRef, packetRef: params.packetRef };
    const task = `Standalone Developer: implement only this approved compact packet. No Team artifact set is required. Parent alone inspects and accepts. Approval metadata is not authenticated user consent.\nApproval: ${params.approvalRef}\nPacket revision: ${params.packetRef}\n` +
      (typeof params.packet === "string" ? params.packet : PACKET_FIELDS.map(key => `\n## ${key}\n${params.packet[key]}`).join("\n"));
    return { params: { agent: "builder", cwd: params.cwd, name: params.name, task, model: params.model, thinking: params.thinking, assignment: params.assignment, escalation: params.escalation }, workflow,
      authority: typeof params.packet === "string" ? params.packet : JSON.stringify(["purpose", "scope", "allowedPaths", "projectRules", "validation", "acceptance"].map(key => params.packet[key])) };

  }
  throw new Error("Unknown execution request kind");
}

export function validateControl(params: ControlRequest): void {
  if (!params || typeof params !== "object" || Array.isArray(params) || !nonempty(params.name) ||
      Object.keys(params).some(key => !["name", "message", "runId", "questionId", "action", "approvalRef", "packetRef", "discoveryAuthorityRef"].includes(key)) ||
      !optionalStrings(params, ["message", "approvalRef", "packetRef", "discoveryAuthorityRef"]) ||
      (params.action !== undefined && !["pause", "stop", "rearm"].includes(params.action))) throw new Error("Only owned delivery control fields are permitted");
}

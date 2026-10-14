import { randomUUID } from "node:crypto";
import { unlinkSync } from "node:fs";
import { atomicJson, readJson } from "./control.ts";

export interface PaneHideRequest {
  action: "hide";
  runId: string;
  requestId: string;
}

export function isPaneHideRequest(value: unknown): value is PaneHideRequest {
  const request = value as Partial<PaneHideRequest> | null;
  return !!request && request.action === "hide" &&
    typeof request.runId === "string" && request.runId.length > 0 && request.runId.length <= 100 &&
    typeof request.requestId === "string" && request.requestId.length > 0 && request.requestId.length <= 100;
}

/** User command only: ask the owning parent to hide this run's pane.
 * No tmux authority or orchestration tools are added to the worker.
 */
export async function requestPaneHide(sessionFile: string, runId: string): Promise<void> {
  const requestId = randomUUID();
  const requestFile = `${sessionFile}.pane-request`;
  const responseFile = `${sessionFile}.pane-response`;
  atomicJson(requestFile, { action: "hide", runId, requestId } satisfies PaneHideRequest);
  try {
    const deadline = Date.now() + 3000;
    do {
      const response = readJson(responseFile);
      if (response?.runId === runId && response?.requestId === requestId) {
        if (response.status !== "hidden") throw new Error(response.error || "Parent could not hide the pane");
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    } while (Date.now() < deadline);
    throw new Error("Hide was not confirmed by the orchestrator; return there and use /subagents hide");
  } finally {
    // Retire only this request: a timed-out command must not hide a pane later.
    if (readJson(requestFile)?.requestId === requestId) {
      try { unlinkSync(requestFile); } catch { /* Parent may have consumed it. */ }
    }
    if (readJson(responseFile)?.requestId === requestId) {
      try { unlinkSync(responseFile); } catch { /* Best-effort response cleanup. */ }
    }
  }
}

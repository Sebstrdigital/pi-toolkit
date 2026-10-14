import { createSurface, closeSurface, closeIdleParking, revealSurface, hideSurface, focusSurface, focusParentSurface } from "./tmux.ts";
import { atomicJson, readJson } from "./control.ts";
import { unlinkSync } from "node:fs";
import { isPaneHideRequest } from "./pane-control.ts";

interface OwnedSurface {
  runId: string;
  sessionFile: string;
  delivery: boolean;
  failure?: string;
  cleanupError?: string;
  detailShown?: boolean;
}

// Reload must not discard a failed kill. Only successful closure removes ownership.
const KEY = Symbol.for(`pi-toolkit/delivery-tmux/owned-surfaces/${import.meta.url}`);
const globals = globalThis as typeof globalThis & { [KEY]?: Map<string, OwnedSurface> };
const owned = globals[KEY] ??= new Map<string, OwnedSurface>();
function shownSurface(): string | undefined {
  return [...owned].find(([, record]) => record.detailShown)?.[0];
}

export function createOwnedSurface(name: string, record: OwnedSurface): string {
  const surface = createSurface(name, { rebalance: !record.delivery });
  // Synchronous, immediately after creation: no setup, await, or transport first.
  owned.set(surface, record);
  return surface;
}

/** Reveal only a still-owned worker; one detail pane may be shown at once. */
export function revealOwnedSurface(surface: string, runId?: string): void {
  const record = owned.get(surface);
  if (!record || (runId !== undefined && record.runId !== runId)) throw new Error("Worker pane is not owned by this runtime");
  const shown = shownSurface();
  if (shown !== surface) {
    if (shown) hideOwnedSurface(shown);
    revealSurface(surface);
    record.detailShown = true;
  }
  focusSurface(surface);
}

/** Hide only the currently shown owned worker without stopping it. */
export function hideOwnedSurface(surface = shownSurface(), runId?: string): void {
  if (!surface) return;
  const record = owned.get(surface);
  if (!record || (runId !== undefined && record.runId !== runId)) throw new Error("Worker pane is not owned by this runtime");
  if (!record.detailShown) return;
  hideSurface(surface);
  record.detailShown = false;
  focusParentSurface();
}

/** Handle only hide requests bound to an owned run; never trust a requested pane id.
 * Called by the parent's TUI lifecycle, including while workers are paused.
 */
export function processOwnedPaneRequests(): void {
  for (const [surface, record] of owned) {
    const file = `${record.sessionFile}.pane-request`;
    const request = readJson(file);
    if (!isPaneHideRequest(request)) continue;
    let error: string | undefined;
    try {
      if (request.runId !== record.runId) throw new Error("Hide request does not match the owned run");
      hideOwnedSurface(surface, request.runId);
    } catch (failure) { error = String(failure); }
    try {
      atomicJson(`${record.sessionFile}.pane-response`, {
        runId: request.runId, requestId: request.requestId,
        status: error ? "error" : "hidden", ...(error ? { error } : {}),
      });
      // Do not acknowledge/erase a newer command that arrived during handling.
      if (readJson(file)?.requestId === request.requestId) unlinkSync(file);
    } catch { /* Retry idempotently if persistence failed; keep execution intact. */ }
  }
}

/** Never close a caller-supplied surface; retain failed closes for teardown retry. */
export function closeOwnedSurface(surface: string, runId?: string): void {
  const record = owned.get(surface);
  if (!record || (runId !== undefined && record.runId !== runId)) return;
  try {
    closeSurface(surface, { rebalance: !record.delivery });
    owned.delete(surface);
  } catch (error) {
    record.cleanupError = String(error);
    throw error;
  }
}

/** The original launch exception remains authoritative even if evidence/kill fails. */
export function rollbackOwnedLaunch(surface: string | undefined, error: unknown, evidence?: OwnedSurface): void {
  if (!surface) return;
  // Teardown can close the pane during shell readiness. Retain the failed-launch
  // classification even after successful closure removed the live ownership.
  const live = owned.get(surface);
  const record = live && (!evidence || live.runId === evidence.runId) ? live : evidence;
  if (!record) return;
  record.failure = String(error);
  try {
    atomicJson(`${record.sessionFile}.launch-failure.json`, {
      runId: record.runId, status: "cancelled", reason: "launch failed",
      error: record.failure, surface,
    });
  } catch { /* Keep in-memory evidence/ownership even when storage is unavailable. */ }
  try { closeOwnedSurface(surface, record.runId); } catch { /* Retry on shutdown/reload. */ }
}

/** A retained failed close must prevent another delivery worker taking the slot. */
export function hasOwnedSurfaces(): boolean { return owned.size > 0; }

/** Active known workers may coexist; failed or orphaned surfaces still block dispatch. */
export function hasUnreconciledSurfaces(activeRunIds: ReadonlySet<string>): boolean {
  return [...owned.values()].some(record => !activeRunIds.has(record.runId) || !!record.failure || !!record.cleanupError);
}

export function cleanupOwnedSurfaces(): unknown[] {
  const errors: unknown[] = [];
  for (const surface of [...owned.keys()]) {
    try { closeOwnedSurface(surface); } catch (error) { errors.push(error); }
  }
  // Launch may have allocated the parking keeper before worker creation failed.
  try { closeIdleParking(); } catch (error) { errors.push(error); }
  return errors;
}

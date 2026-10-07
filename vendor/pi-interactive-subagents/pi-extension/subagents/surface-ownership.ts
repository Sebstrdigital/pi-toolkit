import { createSurface, closeSurface } from "./tmux.ts";
import { atomicJson } from "./control.ts";

interface OwnedSurface {
  runId: string;
  sessionFile: string;
  delivery: boolean;
  failure?: string;
  cleanupError?: string;
}

// Reload must not discard a failed kill. Only successful closure removes ownership.
const KEY = Symbol.for(`pi-toolkit/delivery-tmux/owned-surfaces/${import.meta.url}`);
const globals = globalThis as typeof globalThis & { [KEY]?: Map<string, OwnedSurface> };
const owned = globals[KEY] ??= new Map<string, OwnedSurface>();

export function createOwnedSurface(name: string, record: OwnedSurface): string {
  const surface = createSurface(name, { rebalance: !record.delivery });
  // Synchronous, immediately after creation: no setup, await, or transport first.
  owned.set(surface, record);
  return surface;
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

export function cleanupOwnedSurfaces(): unknown[] {
  const errors: unknown[] = [];
  for (const surface of [...owned.keys()]) {
    try { closeOwnedSurface(surface); } catch (error) { errors.push(error); }
  }
  return errors;
}

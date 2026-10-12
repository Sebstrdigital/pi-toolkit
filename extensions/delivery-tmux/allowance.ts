export interface ExecutionRecord {
  name: string;
  assignmentRoot?: string;
  executionMs?: number;
  runExecutionMs?: number;
}
export function isExecutionRecord(record: ExecutionRecord): boolean {
  return Number.isSafeInteger(record.executionMs) && record.executionMs! >= 0 &&
    Number.isSafeInteger(record.runExecutionMs) && record.runExecutionMs! >= 0 && record.runExecutionMs! <= record.executionMs!;
}

/** Persisted cumulative execution across owned resumes and the one replacement. */
export function remainingExecutionMs(
  id: string, effortMinutes: number, records: Iterable<ExecutionRecord>,
  replacement?: { name: string; remainingEffortMinutes: number },
): number {
  let used = 0, replacementUsed = 0;
  for (const record of records) {
    if (record.assignmentRoot !== id) continue;
    if (!isExecutionRecord(record)) throw new Error("Declared assignment has unmeasured execution; reconcile before continuation");
    used += record.executionMs!;
    if (record.name === replacement?.name) replacementUsed += record.executionMs!;
  }
  const remaining = Math.min(effortMinutes * 60000 - used,
    replacement ? replacement.remainingEffortMinutes * 60000 - replacementUsed : Infinity);
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error("Declared assignment execution allowance exhausted");
  return remaining;
}

export function chargeExecution<T extends ExecutionRecord>(record: T, elapsedMs: number): T {
  if (!isExecutionRecord(record) || !Number.isSafeInteger(elapsedMs) || elapsedMs < record.runExecutionMs!) {
    throw new Error("Execution checkpoint invalid or regressed; reconciliation required");
  }
  const executionMs = record.executionMs! + elapsedMs - record.runExecutionMs!;
  if (!Number.isSafeInteger(executionMs)) throw new Error("Execution checkpoint overflow");
  return { ...record, executionMs, runExecutionMs: elapsedMs };
}

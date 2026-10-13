import { randomUUID } from "node:crypto";

const LIMIT = 16000;
const EVIDENCE_ENTRY = "delivery-tmux-notification-v1";

/** Keep notifications bounded without losing the exact result/question/error. */
export function boundNotification(
  message: any,
  sessionFile: string | undefined,
  appendEntry: (type: string, data: unknown) => void,
): any {
  const bounded = { ...message, details: message.details ? { ...message.details, task: undefined } : undefined };
  if (typeof message.content !== "string" || message.content.length <= LIMIT) return bounded;
  if (!sessionFile) throw new Error("Cannot retain full notification without a parent session file");
  const evidenceId = randomUUID();
  const pointer = { sessionFile, customType: EVIDENCE_ENTRY, evidenceId };
  const marker = `\n\n[TRUNCATED: notification is incomplete. Read ${JSON.stringify(sessionFile)}; find custom entry ${EVIDENCE_ENTRY} with data.evidenceId=${evidenceId}; data.message contains the full notification.]`;
  if (marker.length > LIMIT) throw new Error("Full notification evidence pointer exceeds notification limit");
  // Persist before clipping/delivery. Failure must not masquerade as a full result.
  appendEntry(EVIDENCE_ENTRY, { evidenceId, message });
  bounded.content = message.content.slice(0, LIMIT - marker.length) + marker;
  bounded.details = { ...bounded.details, notificationEvidence: pointer };
  return bounded;
}

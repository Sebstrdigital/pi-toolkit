import assert from "node:assert/strict";
import { test } from "node:test";
import { boundNotification } from "../extensions/delivery-tmux/notifications.ts";

for (const customType of ["subagent_complete", "subagent_question", "subagent_error"]) {
  test(`${customType}: boundary and full notification evidence`, () => {
    const entries: any[] = [];
    const appendEntry = (customType: string, data: unknown) => entries.push({ customType, data });
    for (const length of [15999, 16000, 16001, 32000]) {
      const message = { customType, content: "x".repeat(length) + (length > 16000 ? "TAIL CAVEAT" : ""),
        details: { name: "worker", sessionFile: "/fixture/child.jsonl", task: "original task" } };
      const before = structuredClone(message);
      const bounded = boundNotification(message, "/fixture/parent.jsonl", appendEntry);
      assert.deepEqual(message, before, "Input is not mutated");
      assert.equal(bounded.details.task, undefined);
      if (length <= 16000) {
        assert.equal(bounded.content, message.content);
        continue;
      }
      assert.ok(bounded.content.length <= 16000);
      assert.match(bounded.content, /TRUNCATED/);
      assert.match(bounded.content, /Read .*parent.jsonl/);
      const evidence = entries.at(-1);
      assert.equal(evidence.customType, "delivery-tmux-notification-v1");
      assert.deepEqual(evidence.data.message, message, "Exact full notification, including omitted caveat");
      assert.ok(bounded.content.includes(evidence.data.evidenceId));
      assert.equal(bounded.details.notificationEvidence.evidenceId, evidence.data.evidenceId);
      assert.equal(bounded.details.notificationEvidence.sessionFile, "/fixture/parent.jsonl");
    }
    assert.equal(new Set(entries.map(e => e.data.evidenceId)).size, entries.length);
  });
}

test("non-string content stays intact and evidence failure cannot silently clip", () => {
  const fail = () => { throw Error("storage failed"); };
  const blocks = [{ type: "text", text: "unchanged" }];
  assert.equal(boundNotification({ content: blocks }, "/fixture/parent.jsonl", fail).content, blocks);
  assert.throws(() => boundNotification({ content: "x".repeat(16001) }, "/fixture/parent.jsonl", fail), /storage failed/);
  assert.throws(() => boundNotification({ content: "x".repeat(16001) }, undefined, fail), /session file/);
});

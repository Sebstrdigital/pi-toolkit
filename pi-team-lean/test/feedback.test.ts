import { describe, it, expect } from "vitest";
import { accumulateFeedback, attemptSignature } from "../src/index.js";

describe("accumulateFeedback", () => {
  it("appends successive feedback blocks (does not overwrite)", () => {
    let fb = "";
    fb = accumulateFeedback(fb, "first failure", 1);
    fb = accumulateFeedback(fb, "second failure", 2);
    expect(fb).toContain("first failure");
    expect(fb).toContain("second failure");
    expect(fb).toContain("iteration 1");
    expect(fb).toContain("iteration 2");
    // ordering: newest last
    expect(fb.indexOf("first failure")).toBeLessThan(fb.indexOf("second failure"));
  });

  it("caps total length, keeping the most recent tail", () => {
    let fb = "";
    for (let i = 0; i < 50; i++) fb = accumulateFeedback(fb, "X".repeat(500), i);
    expect(fb.length).toBeLessThanOrEqual(8000);
    // most recent block survives
    expect(fb).toContain("iteration 49");
  });
});

describe("attemptSignature", () => {
  it("is stable for identical diff + failure", () => {
    const a = attemptSignature("diff body", "verify", "test failed: assertion");
    const b = attemptSignature("diff body", "verify", "test failed: assertion");
    expect(a).toBe(b);
  });

  it("differs when the worker diff changes", () => {
    const a = attemptSignature("diff v1", "verify", "same failure");
    const b = attemptSignature("diff v2", "verify", "same failure");
    expect(a).not.toBe(b);
  });

  it("differs when the failure changes", () => {
    const a = attemptSignature("diff", "verify", "failure A");
    const b = attemptSignature("diff", "verify", "failure B");
    expect(a).not.toBe(b);
  });

  it("normalizes whitespace so cosmetic reflow does not look like progress", () => {
    const a = attemptSignature("diff   body", "verify", "test  failed");
    const b = attemptSignature("diff body", "verify", "test failed");
    expect(a).toBe(b);
  });
});

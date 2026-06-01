import { describe, it, expect } from "vitest";
import { truncateForPrompt } from "../src/truncate.js";

describe("truncateForPrompt", () => {
  it("leaves a short diff untouched and reports no truncation", () => {
    const r = truncateForPrompt("small diff", 100);
    expect(r.truncated).toBe(false);
    expect(r.omitted).toBe(0);
    expect(r.text).toBe("small diff");
  });

  it("slices and appends a visible marker when over the cap", () => {
    const diff = "x".repeat(150);
    const r = truncateForPrompt(diff, 100);
    expect(r.truncated).toBe(true);
    expect(r.omitted).toBe(50);
    expect(r.text).toContain("[diff truncated, 50 bytes omitted]");
    // head preserved
    expect(r.text.startsWith("x".repeat(100))).toBe(true);
  });

  it("marker is exact at the boundary", () => {
    expect(truncateForPrompt("y".repeat(100), 100).truncated).toBe(false);
    expect(truncateForPrompt("y".repeat(101), 100).truncated).toBe(true);
  });
});

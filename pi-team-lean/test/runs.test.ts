import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileAtomic } from "../src/runs.js";

describe("writeFileAtomic", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("writes the full content and leaves no temp file behind", () => {
    dir = mkdtempSync(join(tmpdir(), "ptl-runs-"));
    const target = join(dir, "state.json");
    writeFileAtomic(target, '{"a":1}');
    expect(readFileSync(target, "utf8")).toBe('{"a":1}');
    // no .tmp.* sibling left
    expect(readdirSync(dir).filter((f) => f.includes(".tmp."))).toHaveLength(0);
  });

  it("overwrites an existing file atomically", () => {
    dir = mkdtempSync(join(tmpdir(), "ptl-runs-"));
    const target = join(dir, "state.json");
    writeFileAtomic(target, "first");
    writeFileAtomic(target, "second");
    expect(readFileSync(target, "utf8")).toBe("second");
  });
});

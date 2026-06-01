import { describe, it, expect } from "vitest";
import { parseReview } from "../src/reviewer.js";
import { parseJudgement } from "../src/scenarios.js";

describe("reviewer fail-closed parsing (reviewer-judge-fail-open)", () => {
  it("parses a valid approve verdict", () => {
    const r = parseReview('{"verdict":"approve","issues":[],"summary":"lgtm"}');
    expect(r.verdict).toBe("approve");
    expect(r.degraded).toBeUndefined();
  });

  it("parses request_changes with issues", () => {
    const r = parseReview(
      '{"verdict":"request_changes","issues":[{"severity":"must_fix","category":"bug","file":"a.ts","line":3,"problem":"npe","suggested_fix":"guard"}],"summary":"x"}',
    );
    expect(r.verdict).toBe("request_changes");
    expect(r.issues[0]?.severity).toBe("must_fix");
  });

  it("FAILS CLOSED on unparseable output: request_changes + degraded, not approve", () => {
    const r = parseReview("the model said some prose and no json at all");
    expect(r.verdict).toBe("request_changes");
    expect(r.degraded).toBe(true);
    expect(r.parse_error).toBeTruthy();
  });

  it("FAILS CLOSED on truncated/garbage json", () => {
    const r = parseReview('{"verdict":"approve","issues":[');
    expect(r.verdict).toBe("request_changes");
    expect(r.degraded).toBe(true);
  });
});

describe("scenario judge parse marks crashes as errored", () => {
  it("a valid judgement is not errored", () => {
    const j = parseJudgement('{"scenarios":[{"id":"s1","verdict":"pass","evidence":"x","gap":null}],"summary":"ok"}');
    expect(j.errored).toBeUndefined();
    expect(j.scenarios).toHaveLength(1);
  });

  it("unparseable judge output is marked errored (so an all-errored panel fails closed)", () => {
    const j = parseJudgement("not json");
    expect(j.errored).toBe(true);
    expect(j.scenarios).toHaveLength(0);
  });

  it("non-array scenarios is errored", () => {
    const j = parseJudgement('{"scenarios":"oops","summary":"x"}');
    expect(j.errored).toBe(true);
  });
});

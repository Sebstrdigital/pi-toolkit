import { runPi } from "./pi.js";
import type { Scenario } from "./features.js";
import type { Story } from "./types.js";

export type Verdict = "pass" | "fail" | "inconclusive";

interface ScenarioVerdict {
  id: string;
  verdict: Verdict;
  evidence: string;
  gap: string | null;
}

interface SingleJudgement {
  scenarios: ScenarioVerdict[];
  summary: string;
  raw?: string;
  parse_error?: string;
}

interface ConsensusEntry {
  id: string;
  verdict: Verdict;
  votes: { pass: number; fail: number; inconclusive: number };
  evidence: string[];
  gaps: string[];
}

export interface Judgement {
  judges: SingleJudgement[];
  consensus: ConsensusEntry[];
  overall: Verdict;
}

const judgePrompt = (story: Story, scenarios: Scenario[], diff: string, testOutput: string): string => `You are an impartial code reviewer judging whether a worker's implementation satisfies a set of acceptance scenarios. Respond with a single JSON object only — no markdown fences, no prose outside the JSON.

# Story
**Title:** ${story.title}

**Body:**
${story.body}

# Scenarios to judge
${scenarios.map((s) => `- ${s.id}: ${s.text}`).join("\n")}

# Worker diff (what changed)
\`\`\`diff
${diff.slice(0, 60000)}
\`\`\`

# Test command output (last 200 lines)
\`\`\`
${testOutput.split("\n").slice(-200).join("\n")}
\`\`\`

# Output schema
{
  "scenarios": [
    {
      "id": "<scenario id, copy verbatim>",
      "verdict": "pass" | "fail" | "inconclusive",
      "evidence": "<one or two sentences citing file:line or symbol where you found support>",
      "gap": null | "<what is missing if verdict is fail>"
    }
  ],
  "summary": "<one paragraph overall>"
}

# Verdict rules
- "pass": the diff demonstrably implements the scenario behavior. Cite specific file:line.
- "fail": the diff is silent on this scenario, or the implementation contradicts it.
- "inconclusive": the scenario depends on runtime behavior the diff alone cannot prove (UI rendering, network, etc.) AND there is no test output proving it.

Judge based on behavior, not naming. Test method names, identifier choices, and stylistic variants do not affect verdict.

Return JSON now.`;

const parseJudgement = (raw: string): SingleJudgement => {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("no JSON object found");
    const obj = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(obj.scenarios)) throw new Error("scenarios not array");
    return { scenarios: obj.scenarios, summary: obj.summary ?? "", raw };
  } catch (e: unknown) {
    return { scenarios: [], summary: "", raw, parse_error: (e as Error).message };
  }
};

const runOneJudge = async (
  story: Story,
  scenarios: Scenario[],
  diff: string,
  testOutput: string,
  cwd: string,
  model: string | undefined,
): Promise<SingleJudgement> => {
  const r = await runPi(judgePrompt(story, scenarios, diff, testOutput), cwd, model);
  if (r.exitCode !== 0) return { scenarios: [], summary: "", raw: r.stderr, parse_error: `exit ${r.exitCode}` };
  return parseJudgement(r.stdout);
};

const consensusFor = (scenarios: Scenario[], judges: SingleJudgement[]): ConsensusEntry[] =>
  scenarios.map((s) => {
    const votes = { pass: 0, fail: 0, inconclusive: 0 };
    const evidence: string[] = [];
    const gaps: string[] = [];
    for (const j of judges) {
      const v = j.scenarios.find((sv) => sv.id === s.id);
      if (!v) {
        votes.inconclusive++;
        continue;
      }
      votes[v.verdict] = (votes[v.verdict] ?? 0) + 1;
      if (v.evidence) evidence.push(v.evidence);
      if (v.gap) gaps.push(v.gap);
    }
    let verdict: Verdict = "inconclusive";
    if (votes.pass >= 2) verdict = "pass";
    else if (votes.fail >= 2) verdict = "fail";
    return { id: s.id, verdict, votes, evidence, gaps };
  });

const overallFor = (consensus: ConsensusEntry[]): Verdict => {
  if (consensus.some((c) => c.verdict === "fail")) return "fail";
  if (consensus.every((c) => c.verdict === "pass")) return "pass";
  return "inconclusive";
};

export const judgeScenarios = async (
  story: Story,
  scenarios: Scenario[],
  diff: string,
  testOutput: string,
  cwd: string,
  model: string | undefined,
): Promise<Judgement> => {
  const judges = await Promise.all([
    runOneJudge(story, scenarios, diff, testOutput, cwd, model),
    runOneJudge(story, scenarios, diff, testOutput, cwd, model),
    runOneJudge(story, scenarios, diff, testOutput, cwd, model),
  ]);
  const consensus = consensusFor(scenarios, judges);
  return { judges, consensus, overall: overallFor(consensus) };
};

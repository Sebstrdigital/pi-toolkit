import { readFileSync } from "node:fs";

export interface Scenario {
  id: string;
  text: string;
  source: string;
}

interface FeatureStory {
  id: string;
  title: string;
  description: string;
  scenarios: Scenario[];
}

const STORY_HEADING = /^###\s+(US-\d+|S\d+[A-Za-z0-9-]*)\s*:\s*(.+?)\s*$/;
const STORIES_SECTION_HEADING = /^##\s+(?:\d+\.\s*)?User Stories\s*$/i;
const NEXT_SECTION_HEADING = /^##\s+/;
const ACCEPTANCE_LABEL = /^\*\*Acceptance Criteria:\*\*/i;
const DESCRIPTION_LABEL = /^\*\*Description:\*\*\s*(.*)$/i;
const CHECK_ITEM = /^[-*]\s+\[[ xX]?\]\s+(.+?)\s*$/;

export const parseFeatureDoc = (path: string): FeatureStory[] => {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");

  let inStoriesSection = false;
  let current: FeatureStory | null = null;
  let mode: "idle" | "description" | "acceptance" = "idle";
  const stories: FeatureStory[] = [];

  const flush = (): void => {
    if (current) stories.push(current);
    current = null;
    mode = "idle";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (STORIES_SECTION_HEADING.test(line)) {
      inStoriesSection = true;
      continue;
    }
    if (inStoriesSection && NEXT_SECTION_HEADING.test(line) && !STORIES_SECTION_HEADING.test(line)) {
      flush();
      inStoriesSection = false;
      continue;
    }
    if (!inStoriesSection) continue;

    const storyMatch = line.match(STORY_HEADING);
    if (storyMatch) {
      flush();
      current = { id: storyMatch[1]!, title: storyMatch[2]!, description: "", scenarios: [] };
      mode = "idle";
      continue;
    }
    if (!current) continue;

    const descMatch = line.match(DESCRIPTION_LABEL);
    if (descMatch) {
      mode = "description";
      if (descMatch[1]) current.description = descMatch[1].trim();
      continue;
    }
    if (ACCEPTANCE_LABEL.test(line)) {
      mode = "acceptance";
      continue;
    }
    if (mode === "description" && line.trim() && !line.startsWith("**")) {
      current.description = current.description ? `${current.description} ${line.trim()}` : line.trim();
      continue;
    }
    if (mode === "acceptance") {
      const item = line.match(CHECK_ITEM);
      if (item) {
        const idx = current.scenarios.length + 1;
        current.scenarios.push({
          id: `${current.id.toLowerCase()}-c${idx}`,
          text: item[1]!,
          source: `${path}:${i + 1}`,
        });
      }
    }
  }
  flush();

  return stories;
};

export const scenariosForStory = (
  featurePath: string | undefined,
  storyId: string,
  featureStoryId: string | undefined,
): Scenario[] => {
  if (!featurePath) return [];
  const stories = parseFeatureDoc(featurePath);
  const target = featureStoryId ?? storyId;
  const match = stories.find((s) => s.id === target) ?? stories.find((s) => storyId.includes(s.id));
  return match?.scenarios ?? [];
};

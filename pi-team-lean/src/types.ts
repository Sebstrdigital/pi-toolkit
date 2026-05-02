export interface Story {
  id: string;
  title: string;
  body: string;
  depends_on?: string[];
  test_command?: string;
  feature_story_id?: string;
}

export interface Sprint {
  base_branch?: string;
  staging_branch?: string;
  test_command?: string;
  worker_model?: string;
  qa_model?: string;
  judge_model?: string;
  feature_path?: string;
  stories: Story[];
}

export type StoryStatus = "pending" | "in_progress" | "merged" | "failed" | "skipped";

export interface StoryState {
  status: StoryStatus;
  branch?: string;
  commits?: string[];
  failure_reason?: string;
  started_at?: string;
  ended_at?: string;
}

export interface SprintState {
  started_at: string;
  ended_at?: string;
  base_branch: string;
  staging_branch: string;
  stories: Record<string, StoryState>;
}

export interface Story {
  id: string;
  title: string;
  body: string;
  repo_path?: string;
  base_branch?: string;
  depends_on?: string[];
  test_command?: string;
  feature_story_id?: string;
  worker_timeout_min?: number;
}

export interface Sprint {
  base_branch?: string;
  staging_branch?: string;
  test_command?: string;
  worker_model?: string;
  qa_model?: string;
  judge_model?: string;
  reviewer_model?: string;
  feature_path?: string;
  enable_reviewer?: boolean;
  /** Deprecated alias for max_iterations (reviewer-only cap); still honored as a fallback. */
  max_review_iterations?: number;
  /** Overall bounded-retry cap for the delivery loop (worker → reviewer → verify → acceptance). Default 3. */
  max_iterations?: number;
  /** Per-phase retry toggles; each defaults to true. A disabled phase fails hard instead of parking. */
  retry_on?: {
    worker?: boolean;
    reviewer?: boolean;
    test?: boolean;
    acceptance?: boolean;
  };
  worker_timeout_min?: number;
  stories: Story[];
}

export type StoryStatus = "pending" | "in_progress" | "merged" | "failed" | "skipped" | "needs_human";

export interface StoryState {
  status: StoryStatus;
  branch?: string;
  repo_path?: string;
  commits?: string[];
  /** Number of delivery-loop attempts spent on this story. */
  iterations?: number;
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

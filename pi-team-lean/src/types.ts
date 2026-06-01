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
  /**
   * When true, a failed acceptance script logs a warning and proceeds instead of
   * feeding back / parking — the per-story qa-author gate becomes advisory (like
   * scenario-judge). Unset = blocking (current behavior; takt unaffected).
   * See dua-factory docs/QA-AUTHOR.md for why per-story code-level acceptance is
   * the wrong altitude pending the validation-chain redesign.
   */
  acceptance_advisory?: boolean;
  /**
   * When true, skip the post-merge re-verification of the test command on
   * staging. Default (unset) runs the test command on the merged staging branch
   * and reverts+parks the story on failure, so a clean textual merge that is a
   * semantic break never ends a sprint with staging red
   * (acceptance-validates-premerge-no-postmerge-verify).
   */
  skip_postmerge_verify?: boolean;
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

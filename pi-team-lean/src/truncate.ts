/**
 * truncate.ts — make diff truncation VISIBLE (diff-truncation-silent).
 *
 * Reviewer / qa-author / judge prompts cap the worker diff to a fixed char
 * budget. Previously the slice was silent: for any diff over the cap, the gate
 * saw only the head and "approved" the unseen tail — a blind spot that looked
 * like a clean pass. `truncateForPrompt` slices the same way but appends a loud
 * marker so the model (and anyone reading the artifact) knows bytes were
 * dropped, and reports whether truncation happened so the caller can emit an
 * event.
 */

export interface TruncationInfo {
  /** Truncation-marked text, safe to interpolate into a prompt. */
  text: string;
  truncated: boolean;
  /** Number of characters omitted (0 when not truncated). */
  omitted: number;
}

export const truncateForPrompt = (diff: string, cap: number): TruncationInfo => {
  if (diff.length <= cap) return { text: diff, truncated: false, omitted: 0 };
  const omitted = diff.length - cap;
  return {
    text: `${diff.slice(0, cap)}\n\n[diff truncated, ${omitted} bytes omitted]`,
    truncated: true,
    omitted,
  };
};

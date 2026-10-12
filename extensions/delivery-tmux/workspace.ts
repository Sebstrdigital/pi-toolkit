import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

/** Only the current checkout or another linked worktree of its repository. */
export function resolveWorkerWorkspace(current: string, requested?: string): string {
  const cwd = realpathSync(current);
  if (requested === undefined) return cwd;
  if (typeof requested !== "string" || !requested.trim() || requested.includes("\0")) throw new Error("Invalid worker workspace");
  let target: string;
  try { target = realpathSync(requested); }
  catch { throw new Error("Worker workspace unavailable: " + requested); }
  if (target === cwd) return target;
  const listing = execFileSync("git", ["-C", cwd, "worktree", "list", "--porcelain", "-z"], { encoding: "utf8", timeout: 10000 });
  const worktrees = listing.split("\0").filter(line => line.startsWith("worktree ")).map(line => realpathSync(line.slice(9)));
  if (!worktrees.includes(target)) throw new Error("Worker workspace must be a linked worktree of the current repository");
  return target;
}

/** Dispatch is serialized; running workers need not be. Keeps launch hooks unambiguous. */
export class DispatchQueue {
  private tail: Promise<void> = Promise.resolve();
  async acquire(): Promise<() => void> {
    const prior = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await prior;
    return release;
  }
}

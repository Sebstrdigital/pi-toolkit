/**
 * Till-done state — open/closed task list maintained per harness session.
 *
 * In Phase 4 the orchestrator can declare items explicitly. For now each
 * `mention` call implicitly opens an item ("@<role>: <one-line summary>")
 * which is closed when that mention's chain finishes successfully. The
 * orchestrator can also emit `done: <id>` lines (parsed by router.ts) to
 * close any open item.
 */

export interface TillDoneItem {
	id: string;
	description: string;
	state: "open" | "in_progress" | "done" | "failed";
	owner: string;
}

export class TillDone {
	private items: TillDoneItem[] = [];
	private nextId = 1;

	clear(): void {
		this.items = [];
		this.nextId = 1;
	}

	openWithId(id: string, description: string, owner: string): TillDoneItem {
		const item: TillDoneItem = { id, description, state: "open", owner };
		this.items.push(item);
		const numeric = parseInt(id.replace(/^\D+/, ""), 10);
		if (Number.isFinite(numeric) && numeric >= this.nextId) this.nextId = numeric + 1;
		return item;
	}

	open(description: string, owner: string): TillDoneItem {
		const item: TillDoneItem = {
			id: `t${this.nextId++}`,
			description,
			state: "in_progress",
			owner,
		};
		this.items.push(item);
		return item;
	}

	markInProgress(id: string): boolean {
		const item = this.items.find((i) => i.id === id);
		if (!item) return false;
		item.state = "in_progress";
		return true;
	}

	markDone(id: string): boolean {
		const item = this.items.find((i) => i.id === id);
		if (!item) return false;
		item.state = "done";
		return true;
	}

	markFailed(id: string): boolean {
		const item = this.items.find((i) => i.id === id);
		if (!item) return false;
		item.state = "failed";
		return true;
	}

	all(): readonly TillDoneItem[] {
		return this.items;
	}

	progress(): { done: number; total: number } {
		const total = this.items.length;
		const done = this.items.filter((i) => i.state === "done").length;
		return { done, total };
	}
}

# On-demand subagent panes

Subagents start in a private detached tmux parking session, not in the orchestrator's session. Launching, switching and hiding workers add no windows to the orchestrator's window list and do not split it automatically. The blue **Subagents** widget remains the overview: elapsed time, actual tool/activity status, pending-question attention, and preserved paused workers. Hidden workers continue executing and delivering results normally.

The backing parking session may appear in tmux's session picker; it is not a new Dicta/orchestrator window. A runtime-owned keeper pane keeps parking available while the only worker is revealed. Closing the last owned worker also closes that keeper; cleanup never kills a whole session or another user's panes.

## Controls

In the **orchestrator**:

- **`/subagents`** focuses the list. No activation shortcut is registered; **Ctrl+G retains Pi's external prompt-editor behavior**.
- **↑ / ↓** selects an agent, wrapping at the ends. Selection follows the run ID rather than the row position.
- **Enter** moves that agent's existing pane beside the orchestrator and focuses it. It does not launch or restart a session.
- **Esc** leaves list focus and returns input to the prompt.
- **`/subagents hide`**, from **either the orchestrator or the revealed worker**, parks the worker back in the detached parking session and returns focus to the orchestrator. This is safe to repeat.

Once Enter focuses the worker pane, type **`/subagents hide`** there to hide it directly. Use tmux's normal pane navigation to return to the orchestrator if you want to select another worker instead. With tmux's default prefix this is **Ctrl+B, Left** (or **Ctrl+B, o** to cycle panes). A custom tmux configuration may use another prefix or binding. In a worker, `/subagents` explains how to hide; it does not open an agent picker. The worker's hide command sends a run-correlated request to the parent, which checks ownership and acknowledges success or failure. It does not add a model-callable pane-control tool, grant the worker arbitrary tmux control, reply to a question, or stop execution.

One worker detail pane is shown at a time. Selecting another parks the previous one first. Worker pane IDs and processes remain unchanged through reveal/hide. No whole-window layout is selected. After hide/close, the caller pane's original size share is restored, scaled if the window was resized; unrelated panes and processes survive. Normal stop, completion and parent shutdown still close owned workers through the existing lifecycle.

## Input and attention

Arrow keys keep their normal editor/history behavior until list focus is explicitly activated. While focused, list navigation owns ordinary input so text and Enter cannot leak into the prompt. Esc releases that focus; Ctrl+C and Ctrl+G release it and pass through to Pi's normal handling. An overlay/dialog takes precedence over list input. If the last worker disappears, list focus is released.

A valid pending-question sidecar for the current run displays **`!` / `needs input · question`**. Paused workers remain selectable with **`paused; pane preserved`**. Attention does not automatically reveal a pane or steal focus. Questions still use the existing correlated reply protocol; revealing a pane does not count as a reply or approval.

Finished/failed runs retain the existing result/error delivery and cleanup behavior; this change is not a terminal-session archive. UI selection is TUI-only. JSON/print/RPC execution remains independent of these keyboard controls.

## Verification and activation

Repository checks:

```sh
node --test tests/hidden-subagent*.test.ts tests/hidden-worker-parking.test.ts
node --test tests/*.test.ts
git diff --check
```

The focused tests use the actual installed Pi extension loader with fake tmux, plus harmless shell workers on an explicitly addressed unique tmux socket. They cover input isolation, stable selection, attention, paused rows, ownership refusal, move failures, child hide-command routing and failure/retry feedback, stale-run refusal, parallel hidden workers, pane/PID preservation, caller layout restoration and unrelated-pane survival. Parking regressions also assert an unchanged parent-session window list, single-worker reveal/hide, keeper cleanup/retry, fresh session ownership, resized caller geometry, survival of foreign panes added to parking and closure of owned workers retained from the pre-parking runtime. Absence from the parking registry is not treated as proof that a worker was closed. These checks do not certify live model-provider activity or the installed interactive experience.

Initial implementation evidence is in `evidence/hidden-subagent-panes/`; the parent-session window-list correction is in `evidence/hidden-worker-parking/`. No installation, reload, commit or release is performed by this task.

After separately authorized activation, manually check:

1. Start two real workers: the orchestrator window stays unsplit, its tmux window list does not gain worker windows, and both status rows update.
2. Keep text in the prompt; `/subagents`, ↑/↓ and Esc must leave draft text intact. Separately check that Ctrl+G still opens your configured prompt editor.
3. Enter reveals the selected existing worker beside the orchestrator; tmux focus is on that worker.
4. Return to the orchestrator, select the other worker, and confirm the first is hidden but continues working.
5. `/subagents hide` from the worker restores the overview without stopping it. Reveal again and repeat the command from the orchestrator. Both paths must work.
6. A worker question highlights its row without opening anything; correlated replies still work. Pause/rearm/stop retain their existing behavior.
7. Check the list at narrow widths, after resize, with configured keyboard protocols, and while a decision overlay opens.

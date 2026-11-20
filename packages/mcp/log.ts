// One JSON object per line on stderr, so container logs can be filtered and counted.
// Events carry tool names, catalog IDs, client names, timings and token indexes, never arguments,
// file contents or secrets. The one exception is opt-in: MTKIT_LOG_MISSED_TASKS=1 records the
// task text of recommend_tools calls that matched nothing, so operators can see where the catalog misses.
import { AsyncLocalStorage } from "node:async_hooks";

let enabled = false;
let missedTasks = false;
// Fields of the HTTP request being served (the token index), added to events logged while handling it,
// so tool and recommendation events can be grouped per token by the usage report.
const requestFields = new AsyncLocalStorage<Record<string, unknown>>();

export function withLogFields<T>(fields: Record<string, unknown>, run: () => T) {
  return requestFields.run(fields, run);
}

export function enableLogging(options: { missedTasks?: boolean } = {}) {
  enabled = true;
  missedTasks = options.missedTasks === true;
}

export function logEvent(event: Record<string, unknown>) {
  if (!enabled) return;
  process.stderr.write(`${JSON.stringify({ time: new Date().toISOString(), ...requestFields.getStore(), ...event })}\n`);
}

/** Task text for an empty recommendation, only when the operator opted in. */
export function missedTaskText(task: string) {
  return missedTasks ? task.replace(/\s+/g, " ").trim().slice(0, 300) : undefined;
}

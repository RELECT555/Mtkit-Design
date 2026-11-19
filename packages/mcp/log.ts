// One JSON object per line on stderr, so container logs can be filtered and counted.
// Events carry tool names, skill IDs, timings and token indexes, never arguments, file contents or secrets.
let enabled = false;

export function enableLogging() {
  enabled = true;
}

export function logEvent(event: Record<string, unknown>) {
  if (!enabled) return;
  process.stderr.write(`${JSON.stringify({ time: new Date().toISOString(), ...event })}\n`);
}

#!/usr/bin/env node
// Summarizes the JSON event log of a hosted catalog (stderr of `catalog.cjs --hosted`):
//   node packages/mcp/usage-report.mjs server.log [more.log ...]   or   docker logs mtkit 2>&1 | node packages/mcp/usage-report.mjs
// Add --json for machine-readable output.
//
// The server is stateless, so sessions are reconstructed: one session per token and client, started by
// a 2025-era initialize ("session" event) or a 2026-era server/discover request, and closed after
// 30 minutes without events. Clients that never connect are invisible to the server, so the share of
// sessions that used the catalog is an upper bound for "agents that used MTKit when they should have".
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const idleMs = 30 * 60 * 1000;
const catalogTools = new Set(["recommend_tools", "search_entries", "get_skill", "get_entry", "install_skills", "plan_install", "bootstrap_project", "check_skills", "list_categories"]);

const share = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

/** Groups events into sessions and counts how often agents used the catalog and how often recommendations missed. */
export function summarizeUsage(events) {
  const sorted = events.filter(event => typeof event?.time === "string" && typeof event.event === "string")
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const open = new Map();
  const sessions = [];
  const missedTasks = new Map();
  const recommend = { calls: 0, empty: 0, withTagMatches: 0, onlyTagMatches: 0 };

  function sessionFor(key, at, explicitStart) {
    const current = open.get(key);
    if (current && !explicitStart && at - current.last <= idleMs) {
      current.last = at;
      return current;
    }
    // A start event right after tool calls from another window of the same key still opens a new session.
    const session = { key, start: at, last: at, explicitStart, tools: new Set() };
    open.set(key, session);
    sessions.push(session);
    return session;
  }

  for (const event of sorted) {
    const at = Date.parse(event.time);
    const token = event.token ?? "local";
    if (event.event === "session") {
      sessionFor(`${token}|${event.client ?? "unknown"}`, at, true);
    } else if (event.event === "request" && event.mcp === "server/discover") {
      sessionFor(`${token}|discover`, at, true);
    } else if (event.event === "tool" && typeof event.tool === "string") {
      const client = event.client ?? "unknown";
      // 2026-era tool calls join the discover session of the same token when no client-specific one is open.
      const key = open.has(`${token}|${client}`) || !open.has(`${token}|discover`) ? `${token}|${client}` : `${token}|discover`;
      sessionFor(key, at, false).tools.add(event.tool);
    } else if (event.event === "recommend") {
      recommend.calls++;
      const total = (event.rule ?? 0) + (event.tags ?? 0);
      if (total === 0) recommend.empty++;
      if (event.tags > 0) recommend.withTagMatches++;
      if (event.tags > 0 && !event.rule) recommend.onlyTagMatches++;
      if (total === 0 && typeof event.task === "string") missedTasks.set(event.task, (missedTasks.get(event.task) ?? 0) + 1);
    }
  }

  const started = sessions.filter(session => session.explicitStart);
  const used = (session, tools) => [...session.tools].some(tool => tools.has(tool));
  const count = (list, tools) => list.filter(session => used(session, tools)).length;
  const byClient = {};
  for (const session of sessions) {
    const client = session.key.split("|")[1];
    byClient[client] ??= { sessions: 0, usedCatalog: 0, recommend: 0 };
    byClient[client].sessions++;
    if (used(session, catalogTools)) byClient[client].usedCatalog++;
    if (session.tools.has("recommend_tools")) byClient[client].recommend++;
  }
  const toolCounts = {};
  for (const event of sorted) if (event.event === "tool") toolCounts[event.tool] = (toolCounts[event.tool] ?? 0) + 1;

  return {
    period: sorted.length ? { from: sorted[0].time, to: sorted.at(-1).time } : null,
    sessions: {
      started: started.length,
      startedAndUsedCatalog: count(started, catalogTools),
      startedAndCalledRecommend: count(started, new Set(["recommend_tools"])),
      startedAndCalledBootstrap: count(started, new Set(["bootstrap_project"])),
      catalogUseShare: share(count(started, catalogTools), started.length),
      recommendShare: share(count(started, new Set(["recommend_tools"])), started.length),
      withoutStartEvent: sessions.length - started.length,
    },
    recommendations: {
      ...recommend,
      emptyShare: share(recommend.empty, recommend.calls),
      topMissedTasks: [...missedTasks].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([task, times]) => ({ task, times })),
    },
    byClient,
    toolCalls: toolCounts,
  };
}

function printReport(report) {
  const { sessions: s, recommendations: r } = report;
  const lines = [
    report.period ? `Period: ${report.period.from} — ${report.period.to}` : "No events found.",
    "",
    `Sessions with a start event: ${s.started}`,
    `  used any catalog tool:   ${s.startedAndUsedCatalog} (${s.catalogUseShare}%)`,
    `  called recommend_tools:  ${s.startedAndCalledRecommend} (${s.recommendShare}%)`,
    `  called bootstrap_project: ${s.startedAndCalledBootstrap}`,
    `Tool activity without a start event: ${s.withoutStartEvent} session(s)`,
    "",
    `recommend_tools calls: ${r.calls}`,
    `  empty:            ${r.empty} (${r.emptyShare}%)`,
    `  with tag matches: ${r.withTagMatches} (only tags: ${r.onlyTagMatches})`,
  ];
  if (r.topMissedTasks.length) {
    lines.push("", "Most frequent tasks with no recommendation (MTKIT_LOG_MISSED_TASKS=1):");
    for (const { task, times } of r.topMissedTasks) lines.push(`  ${times}× ${task}`);
  }
  const clients = Object.entries(report.byClient);
  if (clients.length) {
    lines.push("", "By client (sessions / used catalog / recommend_tools):");
    for (const [client, { sessions, usedCatalog, recommend }] of clients) lines.push(`  ${client}: ${sessions} / ${usedCatalog} / ${recommend}`);
  }
  const tools = Object.entries(report.toolCalls).sort((a, b) => b[1] - a[1]);
  if (tools.length) lines.push("", `Tool calls: ${tools.map(([tool, calls]) => `${tool} ${calls}`).join(", ")}`);
  console.log(lines.join("\n"));
}

async function readEvents(paths) {
  const events = [];
  const inputs = paths.length ? paths.map(path => createReadStream(path, "utf8")) : [process.stdin];
  for (const input of inputs) {
    for await (const line of createInterface({ input, crlfDelay: Infinity })) {
      const start = line.indexOf("{");
      if (start < 0) continue;
      try {
        events.push(JSON.parse(line.slice(start)));
      } catch {
        // Non-JSON output such as startup messages.
      }
    }
  }
  return events;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const report = summarizeUsage(await readEvents(args.filter(arg => arg !== "--json")));
  if (json) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeUsage } from "./usage-report.mjs";

const at = minutes => new Date(Date.UTC(2026, 10, 20, 9, minutes)).toISOString();

test("sessions are reconstructed per token and client and counted by catalog use", () => {
  const report = summarizeUsage([
    // Session 1: legacy client that asked for recommendations.
    { time: at(0), event: "session", token: 0, client: "claude-code" },
    { time: at(1), event: "tool", token: 0, client: "claude-code", tool: "bootstrap_project" },
    { time: at(2), event: "tool", token: 0, client: "claude-code", tool: "recommend_tools" },
    { time: at(2), event: "recommend", token: 0, client: "claude-code", rule: 2, tags: 1, ids: ["design-screen", "playwright", "bento"] },
    // Session 2: a client connected and never used the catalog.
    { time: at(3), event: "session", token: 1, client: "cursor" },
    // Session 3: 2026-era discover, then a tool call from the same token.
    { time: at(4), event: "request", token: 2, mcp: "server/discover", status: 200 },
    { time: at(5), event: "tool", token: 2, client: "codex", tool: "get_skill" },
    // Same key after more than 30 idle minutes: tool activity without a start event.
    { time: at(50), event: "tool", token: 0, client: "claude-code", tool: "search_entries" },
    { time: at(51), event: "recommend", token: 0, rule: 0, tags: 0, ids: [], task: "Задеплой на Vercel" },
    { time: at(52), event: "recommend", token: 0, rule: 0, tags: 1, ids: ["pptx"] },
    { time: at(53), event: "unrelated" },
    "not an event",
  ]);
  assert.equal(report.sessions.started, 3);
  assert.equal(report.sessions.startedAndUsedCatalog, 2);
  assert.equal(report.sessions.startedAndCalledRecommend, 1);
  assert.equal(report.sessions.startedAndCalledBootstrap, 1);
  assert.equal(report.sessions.catalogUseShare, 66.7);
  assert.equal(report.sessions.withoutStartEvent, 1);
  assert.deepEqual(
    { calls: report.recommendations.calls, empty: report.recommendations.empty, withTagMatches: report.recommendations.withTagMatches, onlyTagMatches: report.recommendations.onlyTagMatches },
    { calls: 3, empty: 1, withTagMatches: 2, onlyTagMatches: 1 },
  );
  assert.deepEqual(report.recommendations.topMissedTasks, [{ task: "Задеплой на Vercel", times: 1 }]);
  assert.equal(report.byClient.cursor.usedCatalog, 0);
  assert.equal(report.toolCalls.recommend_tools, 1);
});

test("an empty log produces an empty report", () => {
  const report = summarizeUsage([]);
  assert.equal(report.period, null);
  assert.equal(report.sessions.catalogUseShare, 0);
});

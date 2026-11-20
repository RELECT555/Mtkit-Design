import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSources } from "./check-skill-updates.mjs";

const pinned = "a".repeat(40);
const newer = "b".repeat(40);

test("sources are compared with the remote head and failures are reported per source", async () => {
  const results = await checkSources([
    { repository: "owner/current", revision: pinned, skills: { one: "." } },
    { repository: "owner/moved", revision: pinned, skills: { two: "skills/two", three: "skills/three" } },
    { repository: "owner/offline", revision: pinned, skills: { four: "." } },
  ], async repository => {
    if (repository === "owner/offline") throw new Error("fatal: unable to access\nmore detail");
    return repository === "owner/moved" ? newer : pinned;
  });
  assert.deepEqual(results.map(({ status }) => status), ["current", "outdated", "error"]);
  assert.equal(results[1].compare, `https://github.com/owner/moved/compare/${pinned}...${newer}`);
  assert.deepEqual(results[1].skills, ["two", "three"]);
  assert.equal(results[2].error, "fatal: unable to access");
});

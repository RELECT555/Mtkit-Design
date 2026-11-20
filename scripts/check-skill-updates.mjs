#!/usr/bin/env node
// Reports external skill sources whose upstream default branch moved past the revision pinned in
// packages/catalog/external-skills.json. Network check, run explicitly:
//   npm run catalog:updates            human-readable table
//   npm run catalog:updates -- --json  machine-readable output
//   npm run catalog:updates -- --fail-on-outdated   exit 1 when any source is behind (for a scheduled job)
// It never edits the lock file: a new revision is third-party code, so review the compare link,
// update `revision` (and `license` if it changed), then run install --prepare-only and catalog:build.
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const lockFile = new URL("../packages/catalog/external-skills.json", import.meta.url);
const concurrency = 6;

/** Latest commit on the remote default branch, read with `git ls-remote` (no API token or rate limit). */
async function remoteHead(repository) {
  const { stdout } = await run("git", ["ls-remote", `https://github.com/${repository}.git`, "HEAD"], {
    timeout: 30_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const revision = stdout.trim().split(/\s+/)[0];
  if (!/^[a-f0-9]{40}$/.test(revision ?? "")) throw new Error("no HEAD revision in ls-remote output");
  return revision;
}

export async function checkSources(sources, head = remoteHead) {
  const results = new Array(sources.length);
  let next = 0;
  async function worker() {
    while (next < sources.length) {
      const index = next++;
      const { repository, revision, skills } = sources[index];
      const base = { repository, skills: Object.keys(skills), pinned: revision };
      try {
        const latest = await head(repository);
        results[index] = latest === revision
          ? { ...base, status: "current", latest }
          : { ...base, status: "outdated", latest, compare: `https://github.com/${repository}/compare/${revision}...${latest}` };
      } catch (error) {
        results[index] = { ...base, status: "error", error: error instanceof Error ? error.message.split("\n")[0] : String(error) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, worker));
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = new Set(process.argv.slice(2));
  const results = await checkSources(JSON.parse(await readFile(lockFile, "utf8")));
  const outdated = results.filter(({ status }) => status === "outdated");
  const failed = results.filter(({ status }) => status === "error");
  if (args.has("--json")) {
    console.log(JSON.stringify({ checked: results.length, outdated: outdated.length, errors: failed.length, sources: results }, null, 2));
  } else {
    for (const result of results) {
      const mark = { current: "ok      ", outdated: "outdated", error: "error   " }[result.status];
      console.log(`${mark} ${result.repository} (${result.skills.join(", ")})`);
      if (result.compare) console.log(`         ${result.compare}`);
      if (result.error) console.log(`         ${result.error}`);
    }
    console.log(`\n${results.length} sources: ${results.length - outdated.length - failed.length} current, ${outdated.length} outdated, ${failed.length} not checked.`);
    if (outdated.length) console.log("Review each compare link before updating `revision` in packages/catalog/external-skills.json.");
  }
  if (failed.length || (args.has("--fail-on-outdated") && outdated.length)) process.exitCode = 1;
}

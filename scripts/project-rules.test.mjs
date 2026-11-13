import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { planProjectRules, setupProjectRules } from "./project-rules.mjs";

const exec = promisify(execFile);
const definition = JSON.parse(await readFile(new URL("../packages/catalog/project-rules.json", import.meta.url), "utf8"));
const setup = fileURLToPath(new URL("./setup-project.mjs", import.meta.url));
const installer = fileURLToPath(new URL("./install.mjs", import.meta.url));

async function fixture(t) {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(join(parent, "mtkit-project-rules-test-"));
  t.after(async () => {
    assert.equal(dirname(await realpath(directory)), parent);
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test("setup creates one client-specific block and repeated setup leaves it unchanged", async (t) => {
  const base = await fixture(t);
  for (const [client, path] of Object.entries(definition.instructionFiles)) {
    const project = join(base, client);
    await mkdir(project);
    const first = await setupProjectRules({ project, client });
    assert.equal(first.action, "create");
    assert.equal(first.changed, true);
    const target = join(project, path);
    const text = await readFile(target, "utf8");
    assert(text.includes(definition.content.trim()));
    const before = await lstat(target);
    const second = await setupProjectRules({ project, client });
    assert.equal(second.action, "unchanged");
    assert.equal(second.changed, false);
    assert.equal(await readFile(target, "utf8"), text);
    assert.equal((await lstat(target)).mtimeMs, before.mtimeMs);
  }
});

test("existing rules, BOM and CRLF survive append and managed-block updates", async (t) => {
  const project = await fixture(t);
  const target = join(project, "AGENTS.md");
  const prefix = "\uFEFF# Project rules\r\n\r\nKeep API contracts and локализация.\r\n";
  await writeFile(target, prefix);
  await setupProjectRules({ project });
  const appended = await readFile(target, "utf8");
  assert(appended.startsWith(prefix));
  assert(!appended.replaceAll("\r\n", "").includes("\n"));

  const suffix = "\r\n\r\n## Team rule\r\nPreserve my exact text.\r\n";
  const beforeBlock = prefix + "\r\n";
  await writeFile(target, `${beforeBlock}${definition.markerStart}\r\nold version\r\n${definition.markerEnd}${suffix}`);
  const changed = await setupProjectRules({ project });
  assert.equal(changed.action, "update");
  const updated = await readFile(target, "utf8");
  assert(updated.startsWith(beforeBlock));
  assert(updated.endsWith(suffix));
  assert(!updated.includes("old version"));
  assert(!updated.replaceAll("\r\n", "").includes("\n"));
});

test("an existing managed block immediately after a BOM remains valid", async (t) => {
  const project = await fixture(t);
  const target = join(project, "AGENTS.md");
  await writeFile(target, `\uFEFF${definition.markerStart}\nold\n${definition.markerEnd}\n`);
  await setupProjectRules({ project });
  assert((await readFile(target, "utf8")).startsWith(`\uFEFF${definition.markerStart}`));
});

test("check reports pending setup without creating directories or files", async (t) => {
  const project = await fixture(t);
  const result = await setupProjectRules({ project, client: "vscode", check: true });
  assert.equal(result.action, "create");
  assert.equal(result.changed, false);
  assert.deepEqual(await readdir(project), []);
  await assert.rejects(exec(process.execPath, [setup, "--project", project, "--client", "vscode", "--check"]), (error) => error.code === 1 && JSON.parse(error.stdout).action === "create");
  assert.deepEqual(await readdir(project), []);
  await exec(process.execPath, [setup, "--project", project, "--client", "vscode"]);
  const { stdout } = await exec(process.execPath, [setup, "--project", project, "--client", "vscode", "--check"]);
  assert.equal(JSON.parse(stdout).action, "unchanged");
});

test("malformed, duplicate and inline markers fail without modifying existing instructions", async (t) => {
  const project = await fixture(t);
  const target = join(project, "AGENTS.md");
  const { markerStart: start, markerEnd: end } = definition;
  for (const content of [start, end, `${end}\n${start}`, `${start}\nx\n${end}\n${start}\nx\n${end}`, `keep ${start}\nx\n${end}`, `${start}\nx\n${end} inline`]) {
    await writeFile(target, content);
    await assert.rejects(setupProjectRules({ project }), /malformed or duplicated/);
    assert.equal(await readFile(target, "utf8"), content);
    assert.deepEqual(await readdir(project), ["AGENTS.md"]);
  }
});

test("concurrent setup never duplicates rules and releases the project lock", async (t) => {
  const project = await fixture(t);
  await writeFile(join(project, "AGENTS.md"), "# Existing rules\n");
  const results = await Promise.allSettled([setupProjectRules({ project }), setupProjectRules({ project })]);
  assert(results.some(result => result.status === "fulfilled"));
  for (const result of results) if (result.status === "rejected") assert.match(result.reason.message, /Installer lock exists/);
  const text = await readFile(join(project, "AGENTS.md"), "utf8");
  assert.equal(text.split(definition.markerStart).length - 1, 1);
  assert(text.startsWith("# Existing rules\n"));
  assert.equal((await setupProjectRules({ project })).action, "unchanged");
  assert.deepEqual(await readdir(project), ["AGENTS.md"]);
});

test("invalid UTF-8 instructions are rejected without rewriting bytes", async (t) => {
  const project = await fixture(t);
  const target = join(project, "AGENTS.md");
  const bytes = Buffer.from([0xff, 0x00, 0xfe]);
  await writeFile(target, bytes);
  await assert.rejects(setupProjectRules({ project }));
  assert.deepEqual(await readFile(target), bytes);
});

test("symbolic instruction directories are rejected without writing outside the project", async (t) => {
  const base = await fixture(t);
  const project = join(base, "project");
  const outside = join(base, "outside");
  await mkdir(project);
  await mkdir(outside);
  await symlink(outside, join(project, ".github"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(setupProjectRules({ project, client: "vscode" }), /symbolic link/);
  assert.deepEqual(await readdir(outside), []);
});

test("symbolic instruction files are rejected", async (t) => {
  const base = await fixture(t);
  const project = join(base, "project");
  await mkdir(project);
  const outside = join(base, "outside.md");
  await writeFile(outside, "keep");
  try { await symlink(outside, join(project, "AGENTS.md"), "file"); }
  catch (error) { if (error.code === "EPERM") { t.skip("This Windows account cannot create file symlinks"); return; } throw error; }
  await assert.rejects(setupProjectRules({ project }), /symbolic link/);
  assert.equal(await readFile(outside, "utf8"), "keep");
});

test("explicit project and known client are required before any setup writes", async (t) => {
  const project = await fixture(t);
  await assert.rejects(planProjectRules({}), /explicit --project/);
  await assert.rejects(setupProjectRules({ project, client: "unsupported" }), /Unsupported client/);
  await assert.rejects(exec(process.execPath, [setup]), /Usage:/);
  await assert.rejects(exec(process.execPath, [setup, "--project", project, "--project", project]), /Usage:/);
  assert.deepEqual(await readdir(project), []);
});

test("plugin installer validates setup options and malformed target before preparing skills", async (t) => {
  const project = await fixture(t);
  await assert.rejects(exec(process.execPath, [installer, "--prepare-only", "--project", project]), /Usage:/);
  await writeFile(join(project, "AGENTS.md"), definition.markerStart);
  await assert.rejects(exec(process.execPath, [installer, "--project", project]), /malformed or duplicated/);
  assert.equal(await readFile(join(project, "AGENTS.md"), "utf8"), definition.markerStart);
});

test("existing instruction file permissions survive replacement", { skip: process.platform === "win32" }, async (t) => {
  const project = await fixture(t);
  const target = join(project, "AGENTS.md");
  await writeFile(target, "# Rules\n");
  await chmod(target, 0o640);
  await setupProjectRules({ project });
  assert.equal((await lstat(target)).mode & 0o777, 0o640);
});

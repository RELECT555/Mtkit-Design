// Opt-in, authenticated Codex evaluation. Uses current CLI authentication,
// ephemeral chats and temporary test data; never changes client configuration.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const parent = await realpath(tmpdir());
const directory = await mkdtemp(join(parent, "mtkit-agent-evaluation-"));
const executable = fileURLToPath(new URL("../../plugins/mtkit-design/dist/catalog.cjs", import.meta.url));
const server = createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html lang="ru"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Поставщики — тест</title><style>body{font:18px system-ui;margin:24px}main{max-width:640px}input,button{font:inherit;display:block;margin-block:12px;max-width:100%;box-sizing:border-box}</style><main><h1>Добавить поставщика</h1><form><label for="name">Название поставщика</label><input id="name" required><button>Сохранить</button></form><p role="status"></p></main><script>document.querySelector('form').onsubmit=e=>{e.preventDefault();document.querySelector('[role=status]').textContent='Поставщик добавлен: '+document.querySelector('input').value}</script></html>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const withBrowser = process.argv.includes("--with-browser");
console.log(`Evaluation evidence: ${directory}`);

async function evaluate(name, prompt, browser = false) {
  const workspace = join(directory, name);
  await mkdir(workspace);
  await writeFile(join(workspace, "package.json"), JSON.stringify({ name: "mtkit-evaluation-fixture", private: true, dependencies: { react: "19.0.0", "@mtkit/ui": "1.1.1" } }));
  const args = ["exec", "--ignore-user-config", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only", "--json", "--color", "never", "-C", workspace,
    "-c", 'mcp_servers.mtkit_catalog.command="node"',
    "-c", `mcp_servers.mtkit_catalog.args=${JSON.stringify([executable])}`,
  ];
  if (browser) args.push("-c", 'mcp_servers.playwright.command="npx"', "-c", 'mcp_servers.playwright.args=["--yes","@playwright/mcp@0.0.85","--headless","--isolated"]', "-c", "mcp_servers.playwright.startup_timeout_sec=120");
  args.push(prompt);
  const child = spawn("codex", args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", value => { stdout += value; });
  child.stderr.on("data", value => { stderr += value; });
  const timer = setTimeout(() => child.kill(), 240_000);
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); }).finally(() => clearTimeout(timer));
  await writeFile(join(directory, `${name}.jsonl`), stdout);
  await writeFile(join(directory, `${name}.stderr.log`), stderr);
  if (code !== 0) throw new Error(`${name}: Codex exited ${code}. ${stderr.slice(-1200)}`);
  const events = stdout.split(/\r?\n/).filter(line => line.startsWith("{")).map(line => JSON.parse(line));
  const calls = events.filter(event => event.type === "item.completed" && event.item.type === "mcp_tool_call").map(event => event.item);
  const summary = { name, calls: calls.map(call => ({ server: call.server, tool: call.tool, status: call.status })), log: join(directory, `${name}.jsonl`) };
  console.log(JSON.stringify(summary));
  const final = events.filter(event => event.type === "item.completed" && event.item.type === "agent_message").at(-1)?.item.text;
  assert(final);
  await writeFile(join(directory, `${name}.md`), final);
  const succeeded = call => call.status === "completed" && !call.error && !call.result?.isError;
  assert(calls.some(call => call.tool === "recommend_tools" && succeeded(call)), `${name}: agent did not ask the catalog for recommendations`);
  assert(calls.some(call => call.tool === "bootstrap_project" && succeeded(call)), `${name}: agent did not obtain project setup guidance`);
  assert(calls.some(call => call.tool === "get_skill" && succeeded(call)), `${name}: agent did not read a recommended skill through MCP`);
  if (!browser) assert.deepEqual(await readdir(workspace), ["package.json"], "Read-only planning must not create persistent project rules");
  if (browser) assert(calls.some(call => call.server === "playwright" && /browser_(click|fill_form|type|press_key)/.test(call.tool) && succeeded(call)), "Agent did not exercise the fixture in Playwright. Check the saved trace and client tool permissions; this evaluation never bypasses approvals.");
}

try {
  const results = await Promise.allSettled([
    evaluate("design", "Нужно спроектировать экран поставщиков для мини-CRM на React и TypeScript с текущей версией @mtkit/ui. Менеджер должен найти поставщика и добавить нового с телефона. Подготовь короткий план на основе доступных рекомендаций и инструкций, учти пустой список, загрузку и ошибку. Пока ничего не создавай, не изменяй и не устанавливай. Ответь по-русски."),
    ...(withBrowser ? [evaluate("review", `Проверь форму добавления поставщика на ${url} на десктопе и телефоне, включая клавиатуру. Это изолированная тестовая страница, можно добавлять вымышленные значения. Проведи только ревью, ничего не изменяй и не устанавливай. Отдели подтверждённые результаты от непроверенных. Ответь кратко по-русски.`, true)] : []),
  ]);
  for (const result of results) if (result.status === "rejected") { console.error(result.reason); process.exitCode = 1; }
  console.log(`Evaluation evidence: ${directory}`);
} finally {
  await new Promise(resolve => server.close(resolve));
  // Preserve text evidence for review. Only temporary fixture workspaces are removed.
  for (const name of withBrowser ? ["design", "review"] : ["design"]) {
    const workspace = join(directory, name);
    assert.equal(dirname(await realpath(workspace)), await realpath(directory));
    await rm(workspace, { recursive: true, force: true });
  }
}

import { catalogCounts, clientLabels, getEntry, installClients, planInstall, recommendForTask } from "../../../packages/catalog/index.ts";
import { connectIntro, connectModes, connectNextStep, featuredToolIds, heroContent, workflowExample } from "../src/features/home/content.ts";
import { escapeHtml } from "./preview-markup.ts";

export function homePreview(hasHostedEndpoint: boolean) {
  const actions = heroContent.actions.map(({ href, label, icon, style }) => `<a class="action action-${style}" href="${href}">${label}<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icon}"></path></svg></a>`).join("");
  const steps = workflowExample.steps.map(({ label }, index) => `<span class="workflow-static-step"${index === 0 ? ' data-state="active"' : ""}>${label}</span>`).join("");
  const items = recommendForTask(workflowExample.task).map(({ entry }) => `<li><a href="/catalog/?entry=${encodeURIComponent(entry.id)}">${escapeHtml(entry.title)}</a><span>${entry.kind === "skill" ? "Навык" : "MCP"}</span></li>`).join("");
  const featured = featuredToolIds.map((id) => {
    const entry = getEntry(id);
    return entry ? `<li><div class="featured-card"><a class="featured-item" href="/catalog/?entry=${encodeURIComponent(id)}"><span class="type-label">${entry.kind === "skill" ? "Навык" : "MCP"}</span><h3>${escapeHtml(entry.title)} <span aria-hidden="true">↗</span></h3><p>${escapeHtml(entry.description)}</p></a></div></li>` : "";
  }).join("");
  const pluginCommands = planInstall("mtkit-catalog")?.steps.map(({ command, args }) => [command, ...args].join(" ")).join("\n");

  return `<div class="page-container home-container">
    <section class="hero" aria-labelledby="hero-title">
      <h1 id="hero-title">${heroContent.title.join("<br>")}<span>.</span></h1>
      <p class="hero-description">${heroContent.description} <code>@mtkit/ui</code>.</p>
      <div class="hero-actions">${actions}</div>
    </section>
    <section class="workflow" id="workflow" aria-labelledby="workflow-title">
      <div class="workflow-grid">
        <div class="workflow-intro">
          <h2 id="workflow-title">${workflowExample.title}</h2>
          <p class="workflow-prompt">«${workflowExample.task}»</p>
        </div>
        <div class="workflow-example">
          <div class="workflow-controls" aria-hidden="true">${steps}</div>
          <div class="workflow-output"><code>${workflowExample.steps[0].tool}</code><ul>${items}</ul></div>
        </div>
      </div>
    </section>
    <section class="featured" id="included" aria-labelledby="featured-title">
      <div class="section-heading"><div><h2 id="featured-title">Что входит в плагин Codex</h2>
        <p>${catalogCounts.bundled - catalogCounts.bundledMcp} навыков <span aria-hidden="true">·</span> ${catalogCounts.bundledMcp} MCP-сервера</p></div>
        <a class="inline-link" href="/catalog/">Все инструменты <span aria-hidden="true">→</span></a>
      </div>
      <ul class="featured-grid">${featured}</ul>
    </section>
  </div>
  <section class="page-container home-container connect" id="connect" aria-labelledby="connect-title">
    <div><h2 id="connect-title">${connectIntro.title}</h2><p class="connect-description">${connectIntro.description}</p></div>
    <div class="connect-panel">
      <p role="status" class="sr-only">Загружаем варианты подключения…</p>
      <p class="loading-retry" role="status" hidden>Варианты подключения пока недоступны. <a href="">Повторить загрузку</a></p>
      <noscript>Включите JavaScript, чтобы увидеть варианты подключения.</noscript>
      <div class="switcher" inert>${installClients.map((id) => `<button type="button" aria-pressed="${id === "codex"}">${clientLabels[id]}</button>`).join("")}</div>
      <div class="switcher" inert>${connectModes.filter(({ id }) => id !== "hosted" || hasHostedEndpoint).map(({ id, label }) => `<button type="button" aria-pressed="${id === "plugin"}">${label}</button>`).join("")}</div>
      <div class="connect-instructions">
        ${pluginCommands ? `<div><p>Выполните команды в корне репозитория MTKit Design.</p><div class="command"><code>${escapeHtml(pluginCommands)}</code><div class="copy-action" inert><button type="button">Копировать</button></div></div></div>` : ""}
        <p>${connectNextStep.intro} ${clientLabels.codex} ${connectNextStep.guidance} <a class="inline-link" href="/guide/">${connectNextStep.guideLabel}</a>.</p>
      </div>
    </div>
  </section>`;
}

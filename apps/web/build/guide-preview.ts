import { guideExamples, guideIntro, guideTroubleshooting } from "../src/features/guide/examples.ts";
import { escapeHtml, loadingStatus } from "./preview-markup.ts";

export function guidePreview() {
  const jumpItems = guideExamples.map(({ id, title }) => `<li><a href="#${escapeHtml(id)}">${escapeHtml(title)}</a></li>`).join("");
  const cards = guideExamples.map(({ id, title, description, prompt, links }) => `<section id="${escapeHtml(id)}" aria-labelledby="${escapeHtml(id)}-title">
    <div class="guide-example">
      <header class="guide-example-heading"><h2 id="${escapeHtml(id)}-title">${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></header>
      <blockquote class="guide-prompt">${escapeHtml(prompt)}</blockquote>
      <div class="guide-actions">
        <div class="copy-action"><button type="button" disabled aria-label="Копировать промпт «${escapeHtml(title)}»">Копировать</button></div>
        ${links?.map(({ href, label }) => `<a class="inline-link" href="${escapeHtml(href)}">${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`).join("") ?? ""}
      </div>
    </div>
  </section>`).join("");
  const steps = guideTroubleshooting.steps.map((step) => `<li>${step.map((part) => typeof part === "string" ? escapeHtml(part) : `<code>${escapeHtml(part.code)}</code>`).join("")}</li>`).join("");

  return `<div class="page-container guide-page">
    <header class="guide-intro">
      <div><h1>${escapeHtml(guideIntro.title)}<span>.</span></h1><p>${escapeHtml(guideIntro.description)}</p></div>
      <a class="guide-connect" href="/#connect">${escapeHtml(guideIntro.connectLabel)} <span aria-hidden="true">↗</span></a>
    </header>
    ${loadingStatus("Загружаем кнопки копирования…")}
    <nav class="guide-jump" aria-label="Сценарии"><ul>${jumpItems}<li><a href="#troubleshooting">Диагностика</a></li></ul></nav>
    <div class="guide-examples">${cards}</div>
    <section id="troubleshooting" class="guide-troubleshooting" aria-labelledby="guide-troubleshooting-title">
      <h2 id="guide-troubleshooting-title">${escapeHtml(guideTroubleshooting.title)}</h2><ol>${steps}</ol>
    </section>
  </div>`;
}

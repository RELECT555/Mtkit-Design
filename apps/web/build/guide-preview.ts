import { guideExamples, guideIntro } from "../src/features/guide/examples.ts";
import { escapeHtml, loadingStatus } from "./preview-markup.ts";

export function guidePreview() {
  const jumpItems = [...guideExamples.map(({ title }) => title), "Диагностика"]
    .map((title) => `<li><span class="guide-loading-jump"><span class="loading-mask">${escapeHtml(title)}</span></span></li>`)
    .join("");
  const cards = guideExamples.map(({ title, description, prompt, links }) => `<section>
    <div class="guide-example">
      <header class="guide-example-heading"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></header>
      <div class="guide-prompt"><span class="loading-mask">${escapeHtml(prompt)}</span></div>
      <div class="guide-actions">
        <span class="guide-loading-copy">Копировать</span>
        ${links?.map(({ label }) => `<span class="guide-loading-link"><span class="loading-mask">${escapeHtml(label)}</span><span class="loading-mask">↗</span></span>`).join("") ?? ""}
      </div>
    </div>
  </section>`).join("");

  return `<div class="page-container guide-page guide-loading">
    <header class="guide-intro">
      <div><h1>${escapeHtml(guideIntro.title)}<span>.</span></h1><p>${escapeHtml(guideIntro.description)}</p></div>
      <span class="guide-connect guide-loading-connect" aria-hidden="true"><span class="loading-mask">${escapeHtml(guideIntro.connectLabel)} ↗</span></span>
    </header>
    ${loadingStatus("Загружаем сценарии…")}
    <div class="guide-jump" aria-hidden="true"><ul>${jumpItems}</ul></div>
    <div class="guide-examples" aria-hidden="true">${cards}</div>
  </div>`;
}

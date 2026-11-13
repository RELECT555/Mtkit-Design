import { catalogCounts, queryCatalog, type CatalogEntry } from "../../../packages/catalog/index.ts";
import { catalogIntro, catalogKinds, catalogPageSize, catalogSummaryRows } from "../src/features/catalog/content.ts";
import { availabilityLabel, kindLabel } from "../src/features/catalog/labels.ts";
import { escapeHtml, loadingStatus } from "./preview-markup.ts";

function catalogCard(entry: CatalogEntry) {
  const title = escapeHtml(entry.title);
  return `<article class="tool" data-availability="${entry.availability}">
    <div><div><div class="tool-labels">
      <span class="type-label type-${entry.kind}">${kindLabel[entry.kind]}</span>
      <span class="availability availability-${entry.availability}">${availabilityLabel[entry.availability]}</span>
    </div><h3>${title}</h3></div>
    <div class="tool-body"><p>${escapeHtml(entry.description)}</p><span class="tool-category">${escapeHtml(entry.category)}</span></div>
    <div class="tool-actions"><a class="tool-detail-link" href="?entry=${encodeURIComponent(entry.id)}" aria-label="Подробнее: ${title}">Подробнее <span aria-hidden="true">→</span></a>
    ${entry.sourceUrl ? `<a class="source-link" href="${escapeHtml(entry.sourceUrl)}" target="_blank" rel="noreferrer" aria-label="Источник: ${title}">Источник <span aria-hidden="true">↗</span></a>` : ""}</div></div>
  </article>`;
}

export function catalogPreview() {
  const { entries, total } = queryCatalog({ limit: catalogPageSize });
  return `<div class="catalog-intro-surface"><div class="page-container catalog-intro">
    <div><a class="inline-link breadcrumb" href="/">← О MTKit Design</a>
      <h1>${escapeHtml(catalogIntro.title)}<span>.</span></h1><p>${escapeHtml(catalogIntro.description)}</p></div>
    <aside class="catalog-summary" aria-labelledby="catalog-summary-title">
      <div class="summary-heading"><span id="catalog-summary-title">Состав MTKit Design</span><code>mtkit_catalog</code></div>
      <dl>${catalogSummaryRows.map(([label, count]) => `<div><dt>${label}</dt><dd>${catalogCounts[count]}</dd></div>`).join("")}</dl>
    </aside>
  </div></div>
  <section class="page-container directory" aria-label="Инструменты каталога">
    ${loadingStatus("Загружаем фильтры каталога…")}
    <div class="catalog-filters" inert>
      <label class="search-field"><span class="search-icon" aria-hidden="true"></span><input type="search" placeholder="${escapeHtml(catalogIntro.searchPlaceholder)}"></label>
      <label class="category-field"><select><option>Все категории</option></select></label>
      <label class="category-field availability-field"><select><option>Любое подключение</option></select></label>
    </div>
    <div class="results-bar">
      <div class="switcher" inert>${catalogKinds.map(({ label, value }) => `<button type="button" aria-pressed="${!value}">${label}</button>`).join("")}</div>
      <div class="results-meta"><h2>Найдено ${total} из ${catalogCounts.total}</h2></div>
    </div>
    <div class="card-grid">${entries.map(catalogCard).join("")}</div>
    <div class="pagination" inert><button type="button" disabled>← Назад</button><span>Страница 1 из ${Math.ceil(total / catalogPageSize)}</span><button type="button">Далее →</button></div>
  </section>`;
}

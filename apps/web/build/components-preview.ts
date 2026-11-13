import { componentCategories, componentDemos, componentGalleryDescription, likeHeartPath } from "../src/features/components/content.ts";
import { radius, rowAngle, rowHeight, twoDigits, wheelDefaults, wheelRows, wheelRowTransform, wrap } from "../src/features/components/wheel-picker-layout.ts";
import { galleryFiltersPreview } from "./gallery-filters-preview.ts";
import { loadingStatus } from "./preview-markup.ts";

function wheelColumn(center: number, count: number) {
  const rows = wheelRows(center).map((row) => `<span class="wheel-row" style="transform:${wheelRowTransform(row)}">${twoDigits(wrap(row, count))}</span>`).join("");
  return `<div class="wheel-column" style="--wheel-radius:${radius}px;--wheel-initial-rotation:${center * rowAngle}deg">
    <div class="wheel-fade"><div class="wheel-depth"><div class="wheel-drum">${rows}</div></div>
    <div class="wheel-depth" data-band="true"><div class="wheel-drum">${rows}</div></div></div>
  </div>`;
}

export function componentsPreview() {
  const { loader, like, wheel } = componentDemos;
  const { hours, minutes, label } = wheelDefaults;
  const demos = Object.values(componentDemos);
  return `<div class="page-container gallery-container"><div class="gallery-layout">
    <header class="gallery-heading"><h1 id="component-library-title">Компоненты</h1><p>${componentGalleryDescription}</p></header>
    ${galleryFiltersPreview("component", "Поиск компонентов", componentCategories(demos))}
    <section class="gallery-results" aria-labelledby="component-library-title">
    ${loadingStatus("Загружаем интерактивные примеры…")}
    <div class="gallery-toolbar"><p>Компонентов: ${demos.length}</p></div>
    <ul class="gallery-grid">
      <li><div class="component-preview" id="${loader.id}">
        <div class="component-preview-stage" aria-hidden="true"><div class="loader-preview-placeholder"></div></div>
        <div class="component-preview-caption"><h2>${loader.title}</h2><p>${loader.description}</p>
          <button class="loader-open" type="button" aria-haspopup="dialog" disabled>${loader.action}</button>
        </div>
      </div></li>
      <li><div class="component-preview" id="${like.id}">
        <div class="component-preview-stage" inert>
          <button class="like-burst" type="button" aria-label="Нравится" aria-pressed="false">
            <span class="like-burst-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="${likeHeartPath}"></path></svg></span>
            <span class="like-burst-count" aria-hidden="true"><span><span>0</span></span></span>
          </button>
        </div>
        <div class="component-preview-caption"><h2>${like.title}</h2><p>${like.description}</p></div>
      </div></li>
      <li><div class="component-preview" id="${wheel.id}">
        <div class="component-preview-stage" inert><div class="wheel-demo">
          <div class="wheel-demo-label"><span>${label}</span><output>${twoDigits(hours)}:${twoDigits(minutes)}</output></div>
          <div class="wheel-picker" style="--wheel-row:${rowHeight}px">
            ${wheelColumn(hours, 24)}<span class="wheel-separator" aria-hidden="true">:</span>${wheelColumn(minutes, 60)}
          </div>
        </div></div>
        <div class="component-preview-caption"><h2>${wheel.title}</h2><p>${wheel.description}</p><a class="inline-link" href="/src/features/components/WHEEL-PICKER-LICENSE.txt" data-preview-asset>Лицензия MIT</a></div>
      </div></li>
    </ul>
    </section>
  </div></div>`;
}

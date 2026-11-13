import { shaderCategoryIcons, shaderGalleryDescription } from "../src/features/shaders/gallery-content.ts";
import { shaderPresets, type ShaderPreset } from "../src/features/shaders/presets.ts";
import { escapeHtml, loadingStatus, previewIcon } from "./preview-markup.ts";

const categories = [...new Set(shaderPresets.map(({ group }) => group))];

function shaderBackdrop({ palettes }: ShaderPreset) {
  const [primary, secondary] = palettes[0].colors;
  return `<div class="shader-frame" aria-hidden="true" style="--shader-primary:${escapeHtml(primary)};--shader-secondary:${escapeHtml(secondary)}"></div>`;
}

function shaderCard(preset: ShaderPreset) {
  return `<li><div class="shader-card">
    <a class="shader-card-link" id="shader-card-${escapeHtml(preset.id)}" href="?shader=${encodeURIComponent(preset.id)}">
      <div class="shader-card-preview">${shaderBackdrop(preset)}</div>
      <div class="shader-card-caption">
        <div><h2>${escapeHtml(preset.name)}</h2><p>${escapeHtml(preset.group)}</p></div>
        <span class="shader-card-arrow" aria-hidden="true">${previewIcon("M6 18 18 6M6 6h12v12", "", 20)}</span>
      </div>
    </a>
  </div></li>`;
}

function shaderDetailPreview(preset: ShaderPreset) {
  return `<template data-shader-preview="${escapeHtml(preset.id)}">
    <div class="page-container shader-library"><article class="shader-studio" aria-labelledby="shader-title">
      <header class="shader-heading">
        <nav class="shader-crumb" aria-label="Навигация по шейдерам"><a href="/shaders/"><span aria-hidden="true">←</span> Все шейдеры</a><span aria-hidden="true">/</span> ${escapeHtml(preset.group)}</nav>
        <h1 id="shader-title">${escapeHtml(preset.name)}</h1>
        <p class="shader-description">${escapeHtml(preset.description)}</p>
      </header>
      <div class="shader-workbench">
        <div class="shader-toolbar">
          <div class="shader-tabs" inert><button type="button" data-state="active">Превью</button><button type="button">Код</button><button type="button">Промпт</button></div>
          <code class="shader-filename">${escapeHtml(preset.componentName)}.tsx</code>
        </div>
        <div class="shader-tab-content"><div class="shader-preview">${shaderBackdrop(preset)}
          <div class="shader-preview-tools" inert>
            ${preset.renderer?.image ? '<button type="button">Оригинал</button>' : ""}
            <button type="button">С контентом</button><button type="button" class="shader-preview-loading-play"><span>Ⅱ</span> Пауза</button><button type="button" class="shader-preview-loading-start"><span>▸</span> Пуск</button><button type="button">⛶</button>
          </div>
        </div></div>
      </div>
      ${loadingStatus("Загружаем настройки шейдера…")}
    </article></div>
  </template>`;
}

export function shaderPreview() {
  return `<div class="page-container shader-library gallery-container" data-shader-gallery-preview>
    <div class="shader-gallery">
      <header class="shader-gallery-heading"><h1 id="shader-gallery-title">Шейдеры</h1><p>${shaderGalleryDescription}</p></header>
      <aside class="shader-sidebar" aria-labelledby="shader-filter-title" inert>
        <div class="shader-filter-heading"><h2 id="shader-filter-title">${previewIcon("M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6")}Фильтры</h2><button type="button" class="shader-filter-reset" disabled>Сбросить</button></div>
        <div class="shader-search">${previewIcon("M16 16l4 4M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0", "shader-search-icon")}<input type="search" placeholder="Поиск шейдеров"></div>
        <div class="shader-category"><h3>Категории</h3><div class="shader-category-options">
          ${(["", ...categories] as const).map((category) => `<button type="button" aria-pressed="${!category}">${previewIcon(shaderCategoryIcons[category], "shader-category-icon")}<span class="shader-category-label">${category || "Все шейдеры"}</span><span class="shader-category-count">${category ? shaderPresets.filter(({ group }) => group === category).length : shaderPresets.length}</span></button>`).join("")}
        </div></div>
      </aside>
      <section class="shader-gallery-main" aria-labelledby="shader-gallery-title">
        ${loadingStatus("Загружаем превью шейдеров…")}
        <div class="shader-gallery-toolbar"><p>Компонентов: ${shaderPresets.length}</p><button type="button" class="shader-preview-toggle" inert><span>Ⅱ</span> Пауза превью</button></div>
        <ul class="shader-grid">${shaderPresets.map(shaderCard).join("")}</ul>
      </section>
    </div>
  </div>${shaderPresets.map(shaderDetailPreview).join("")}`;
}

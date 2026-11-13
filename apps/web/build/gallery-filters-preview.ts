import type { GalleryCategory } from "../src/shared/GalleryFilters.tsx";
import { galleryFilterIcons } from "../src/shared/gallery-filter-icons.ts";
import { escapeHtml, previewIcon } from "./preview-markup.ts";

export function galleryFiltersPreview(id: string, searchLabel: string, categories: readonly GalleryCategory[]) {
  return `<aside class="gallery-sidebar" aria-labelledby="${id}-filter-title" inert>
    <div class="gallery-filter-heading"><h2 id="${id}-filter-title">${previewIcon(galleryFilterIcons.filters)}Фильтры</h2><button type="button" class="gallery-filter-reset" disabled>Сбросить</button></div>
    <div class="gallery-search">${previewIcon(galleryFilterIcons.search, "gallery-search-icon")}<input type="search" placeholder="${escapeHtml(searchLabel)}"></div>
    <div class="gallery-category"><h3>Категории</h3><div class="gallery-category-options">
      ${categories.map(({ id: option, label, icon, count }) => `<button type="button" aria-pressed="${!option}">${previewIcon(icon, "gallery-category-icon")}<span class="gallery-category-label">${escapeHtml(label)}</span><span class="gallery-category-count">${count}</span></button>`).join("")}
    </div></div>
  </aside>`;
}

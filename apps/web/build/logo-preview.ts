import { logoIcons, logoIntro, logoVariants } from "../src/features/logo/content.ts";
import { loadingStatus, previewIcon } from "./preview-markup.ts";

export function logoPreview() {
  return `<section class="page-container logo-page" aria-labelledby="logo-title">
    <header class="logo-intro"><h1 id="logo-title">${logoIntro.title} <span>${logoIntro.brand}</span></h1><p>${logoIntro.description}</p></header>
    ${loadingStatus("Загружаем управление логотипом…")}
    <div class="logo-viewer">
      <div class="logo-toolbar" inert>
        <div class="logo-variants"><button type="button" aria-pressed="true">${logoVariants.logo.label}</button><button type="button" aria-pressed="false">${logoVariants.badge.label}</button></div>
        <button type="button" class="logo-toggle">${previewIcon(logoIcons.model, "", 16)} 3D-просмотр</button>
      </div>
      <div class="logo-stage" data-model="logo"><img class="logo-poster" src="/src/features/logo/mtkit-logo-render.png" alt="${logoVariants.logo.label} ${logoIntro.brand}"></div>
      <div class="logo-footer"><code class="logo-filename">${logoVariants.logo.filename}</code>
        <a class="logo-download" data-slot="button" href="/src/features/logo/mtkit-design-3d.glb" data-preview-asset download="${logoVariants.logo.filename}">${previewIcon(logoIcons.download, "", 16)} Скачать GLB</a>
      </div>
    </div>
  </section>`;
}

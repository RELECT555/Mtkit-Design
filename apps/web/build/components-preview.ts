import { componentDemos, loaderChoices } from "../src/features/components/content.ts";
import { loadingStatus } from "./preview-markup.ts";

function choices(legend: string, options: Record<string, string>, selected: string) {
  return `<fieldset><legend>${legend}</legend><div class="loader-choice-row">${Object.entries(options).map(([value, label]) => `<label><input type="radio"${value === selected ? " checked" : ""}><span>${label}</span></label>`).join("")}</div></fieldset>`;
}

export function componentsPreview() {
  const { loader, like, wheel } = componentDemos;
  return `<section class="page-container gallery-container component-library" aria-labelledby="component-library-title">
    <h1 id="component-library-title">Компоненты</h1>
    ${loadingStatus("Загружаем интерактивные примеры…")}
    <div class="component-preview-grid">
      <div class="component-preview loader-demo" id="shader-loader">
        <div class="component-preview-stage loader-demo-stage" inert><div class="loader-preview-placeholder"></div><button class="loader-playback" type="button">Пауза</button></div>
        <div class="component-preview-caption"><h2>${loader.title}</h2><p>${loader.description}</p>
          <div class="loader-demo-controls" inert>
            ${choices("Форма", loaderChoices.shapes, "sphere")}
            ${choices("Стиль", loaderChoices.variants, "dither")}
            ${choices("Размер, px", loaderChoices.sizes, "default")}
            <label class="loader-speed"><span>Скорость <output>1.00×</output></span><input type="range" value="1" min="0.25" max="2" step="0.05"></label>
            <label class="loader-color"><span>Цвет</span><input type="color" value="#00b3ff"><code>#00b3ff</code></label>
          </div>
          <div class="loader-export" inert><button type="button">Копировать TSX</button><button type="button">Скачать .tsx</button></div>
          <p class="loader-export-hint">Один React-файл и пример с текущими настройками.</p><p class="loader-feedback"></p>
          <a class="inline-link" href="https://ds.asanshay.com/loader" target="_blank" rel="noreferrer">Оригинал от asanshay <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <div class="component-preview">
        <div class="component-preview-stage" inert><button class="like-burst" type="button"><span class="like-burst-icon"><span class="loading-mask">♡</span></span><span class="loading-mask">0</span></button></div>
        <div class="component-preview-caption"><h2>${like.title}</h2><p>${like.description}</p></div>
      </div>
      <div class="component-preview">
        <div class="component-preview-stage" inert><div class="wheel-demo"><div class="wheel-demo-label"><span class="loading-mask">Выберите время</span><output class="loading-mask">09:41</output></div><div class="wheel-picker"><div class="wheel-column"></div><span class="wheel-separator">:</span><div class="wheel-column"></div></div></div></div>
        <div class="component-preview-caption"><h2>${wheel.title}</h2><p>${wheel.description}</p><a class="inline-link" href="/src/features/components/WHEEL-PICKER-LICENSE.txt">Лицензия MIT</a></div>
      </div>
    </div>
  </section>`;
}

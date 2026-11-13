export const componentDemos = {
  loader: { title: "Shader Loader", description: "Индикатор загрузки: три формы и три способа отрисовки." },
  like: { title: "Like Burst", description: "Поставьте отметку «Нравится» и посмотрите, как меняется счётчик." },
  wheel: { title: "Wheel Picker", description: "Выберите время колёсиком мыши, жестом или стрелками." },
};

export const loaderChoices = {
  shapes: { sphere: "Сфера", swirl: "Вихрь", ripple: "Рябь" },
  variants: { plain: "Чёткий", blur: "Мягкий", dither: "Пиксельный" },
  sizes: { sm: "48", default: "80", lg: "120" },
} as const;

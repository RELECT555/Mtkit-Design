import { galleryFilterIcons } from "../../shared/gallery-filter-icons.ts";

export const componentGalleryDescription = "Интерактивные компоненты для React и TypeScript.";
export const likeHeartPath = "M20.8 5.7a5 5 0 0 0-7.1 0L12 7.4l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.2a5 5 0 0 0 0-7.1Z";

const categories = [
  { id: "", label: "Все компоненты", icon: galleryFilterIcons.all },
  { id: "loaders", label: "Лоадеры", icon: "M20 12a8 8 0 1 1-8-8" },
  { id: "buttons", label: "Кнопки", icon: "M4 7h16v10H4z M9 12h6" },
  { id: "inputs", label: "Ввод", icon: "M4 6h16v12H4z M9 9v6m-2-6h4m-4 6h4" },
] as const;

export type ComponentCategory = typeof categories[number]["id"];

export const componentDemos = {
  loader: { id: "shader-loader", category: "loaders", title: "Shader Loader", description: "Индикатор загрузки: три формы и три способа отрисовки.", action: "Открыть демо" },
  like: { id: "like-burst", category: "buttons", title: "Like Burst", description: "Поставьте отметку «Нравится» и посмотрите, как меняется счётчик." },
  wheel: { id: "wheel-picker", category: "inputs", title: "Wheel Picker", description: "Выберите время колёсиком мыши, жестом или стрелками." },
} as const;

export function componentCategories(matching: readonly { category: ComponentCategory }[]) {
  return categories.map((option) => ({
    ...option,
    count: option.id ? matching.filter((demo) => demo.category === option.id).length : matching.length,
  }));
}

export const loaderChoices = {
  shapes: { sphere: "Сфера", swirl: "Вихрь", ripple: "Рябь" },
  variants: { plain: "Чёткий", blur: "Мягкий", dither: "Пиксельный" },
  sizes: { sm: "48", default: "80", lg: "120" },
} as const;

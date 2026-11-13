import { getEntry } from "./entries.js";
import type { CatalogEntry } from "./types.js";

export interface TaskRecommendation {
  entry: CatalogEntry;
  reason: string;
}

const recommendationLimit = 6;
const screen = /\b(?:ui|frontend|front end|screens?|pages?|landing|dashboards?|layouts?|mockups?|interfaces?|forms?)\b|экран|интерфейс|страниц[ауые]|лендинг|фронтенд|дашборд|макет|верстк|(?:^| )форм[ауые](?: |$)/u;
const crm = /\bcrm\b|(?:^| )срм(?: |$)/u;
const create = /\b(?:build|create|make|design|redesign|implement|prototype|new|want|need)\b|сдела(?:й|ть)|созда(?:й|ть)|соб(?:ери|рать)|спроектир|реализ|редизайн|нов(?:ый|ую|ая|ое)|нуж(?:ен|на|но)|хочу|красив/u;
const review = /\b(?:review|audit|check|test|verify|inspect|compare|broken)\b|прове(?:р|ди)|ревью|аудит|протестируй|сравни|лома/u;
const browser = /\b(?:browsers?|playwright|responsive|desktop|mobile|e2e|viewport|screenshot)\b|браузер|адаптив|десктоп|мобильн|телефон|скриншот|переполнени/u;
const accessible = /\b(?:accessibility|a11y|wcag|aria|keyboard|screen readers?|focus trap|focus order)\b|доступност|клавиатур|скринридер|порядок фокус|(?:^| )фокус(?: |$)/u;
const publicDependency = /\b(?:react|next js|vite|tailwind|radix|typescript|tanstack|gsap|zod|shadcn|context7)\b|публичн\p{L}* библиотек/u;
const docs = /\b(?:docs|documentation|api reference|how (?:do|does|to)|what (?:is|does))\b|документаци|справк|официальн\p{L}* пример|как (?:работает|использовать|подключить|настроить)|уточни api|сверь api/u;
const change = /\b(?:fix|repair|improve|implement)\b|исправ|почин|улучш|реализ/u;
const vital = /\b(?:core web vitals|lcp|inp|cls)\b/u;
const pagePerformance = /\b(?:lighthouse|bundle size|page load|web performance)\b|размер бандла|скорость загрузки|веб производительност/u;
const animation = /\b(?:animation|animations|motion|gsap)\b|анимаци|рывк/u;
const registry = /\b(?:shadcn|components json)\b/u;

export function recommendForTask(task: string): TaskRecommendation[] {
  const text = task.toLowerCase().replaceAll("ё", "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const hasScreen = screen.test(text);
  const needsDesign = (hasScreen || crm.test(text)) && create.test(text);
  const needsAccessibility = accessible.test(text);
  const needsBrowserReview = (review.test(text) && (hasScreen || browser.test(text) || needsAccessibility))
    || (hasScreen && change.test(text) && !needsDesign);
  const needsDocs = publicDependency.test(text) && (docs.test(text) || /\bcontext7\b/u.test(text));
  const recommendations: TaskRecommendation[] = [];
  const companions: TaskRecommendation[] = [];

  function add(id: string, reason: string, target = recommendations) {
    const entry = getEntry(id);
    if (entry) target.push({ entry, reason });
  }

  if (needsDesign) add("design-screen", "Helps design and implement the requested screen with the project's existing components and MTKit UI.");
  if (needsBrowserReview || needsAccessibility) add("review-screen", "Guides a browser review of the existing screen, including the primary workflow and relevant interaction checks.");
  if (needsDocs) add("library-docs", "Checks the public dependency API against its documentation and the version in the project.");

  if (needsAccessibility) {
    if (change.test(text)) add("fixing-accessibility", "Helps fix keyboard, focus and accessibility issues in the interface.");
    else add("accessibility", "Adds focused accessibility checks such as keyboard navigation and WCAG requirements.");
  }
  if (vital.test(text)) add("core-web-vitals", "Helps measure and diagnose the requested Core Web Vitals.");
  else if (pagePerformance.test(text)) add("performance", "Helps measure and improve page loading and JavaScript bundle size.");
  if (animation.test(text)) {
    if (/\bgsap\b/u.test(text)) {
      if (/\breact\b/u.test(text)) add("gsap-react", "Covers GSAP lifecycle and cleanup in React components.");
      else add("gsap-core", "Covers the GSAP primitives needed for this animation.");
    } else if (review.test(text)) add("review-animations", "Helps review motion, transitions and their role in the interaction.");
  }
  if (/\b(?:design tokens?|design systems?)\b|дизайн систем|токен\p{L}* (?:тем|дизайн|цвет)/u.test(text)) {
    add("design-system", "Helps organize semantic tokens and maintain consistent components.");
  } else if (/\b(?:palettes?|color contrast)\b|палитр|контраст цветов/u.test(text)) {
    add("color-expert", "Helps choose and validate the requested palette or contrast.");
  }
  if (/\b(?:seo|open graph)\b|поисковая оптимизаци/u.test(text)) add("seo", "Covers discoverability, metadata and indexing checks.");

  if (registry.test(text) && !needsDocs) {
    add("shadcn", "Helps work with shadcn components and registries when the project is configured for them.");
    add("shadcn-mcp", "Finds matching components and examples in the configured shadcn registry.");
  }

  if (needsBrowserReview || needsAccessibility || needsDesign) add("playwright", "Runs the interface in a browser to verify the relevant workflow, viewport and keyboard behavior.", companions);
  if (needsDocs) add("context7", "Retrieves public library documentation and version-sensitive API examples.", companions);
  return [...recommendations.slice(0, recommendationLimit - companions.length), ...companions];
}

import { getEntry } from "./entries.js";
import type { CatalogEntry } from "./types.js";

export interface TaskRecommendation {
  entry: CatalogEntry;
  reason: string;
}

const recommendationLimit = 6;
const screen = /\b(?:ui|frontend|front end|screens?|pages?|landing|dashboards?|layouts?|mockups?|interfaces?|forms?|dialogs?|modals?|buttons?|web app)\b|экран|интерфейс|страниц[ауые]|лендинг|фронтенд|дашборд|макет|верстк|диалог|модальн|кнопк|(?:^| )форм[ауые](?: |$)/u;
const crm = /\bcrm\b|(?:^| )срм(?: |$)/u;
const create = /\b(?:build|create|make|add|redesign|implement|prototype)\b|(?:^|\b(?:and|then|to) )design\b|\bdesign (?:a|an|the|this|our|my|new)\b|сдела(?:й|ть)|созда(?:й|ть)|соб(?:ери|рать)|добав|спроектир|реализ|редизайн|сверста/u;
const desire = /\b(?:new|want|need)\b|нов(?:ый|ую|ая|ое)|нуж(?:ен|на|но)|хочу|красив/u;
const polish = /\b(?:polish|refine|tidy|improve)\b|причеш|причес|улучш/u;
const review = /\b(?:review|audit|check|test|verify|inspect|compare|broken)\b|прове(?:р|ди)|ревью|аудит|протестируй|сравни|лома/u;
const browser = /\b(?:browsers?|playwright|responsive|desktop|mobile|e2e|viewport|screenshot)\b|браузер|адаптив|десктоп|мобильн|телефон|скриншот|переполнени/u;
const accessible = /\b(?:accessibility|a11y|wcag|aria|keyboard|screen readers?|focus trap|focus order)\b|доступност|клавиатур|скринридер|порядок фокус|(?:^| )фокус(?: |$)/u;
const publicDependency = /\b(?:react|next js|vite|tailwind|radix|typescript|tanstack|gsap|zod|shadcn|context7)\b|публичн\p{L}* библиотек/u;
const library = /\b(?:libraries|library|npm package)\b|библиотек|npm пакет/u;
const privateDependency = /\b(?:mtkit|private|internal)\b|закрыт|внутренн/u;
const docs = /\b(?:docs|documentation|api reference|how (?:do|does|to)|what (?:is|does))\b|документаци|справк|официальн\p{L}* пример|как (?:работает|использовать|подключить|настроить)|уточни api|сверь api/u;
const change = /\b(?:fix|repair|improve|implement)\b|исправ|почин|улучш|реализ/u;
const vital = /\b(?:core web vitals|lcp|inp|cls)\b/u;
const pagePerformance = /\b(?:lighthouse|bundle|page load|web performance|slow (?:page|website|app))\b|бандл|скорость загрузки|веб производительност|медленн\p{L}* (?:страниц|сайт|приложен)/u;
const animation = /\b(?:animation|animations|motion|gsap)\b|анимаци|рывк/u;
const motionPerformance = /\b(?:jank|fps|stutter|lag|performance)\b|рывк|тормоз|производительност/u;
const registry = /\b(?:shadcn|components json)\b/u;

function positiveTaskText(task: string) {
  // Exclude explicit constraints from keyword routing. This is deliberately
  // conservative: "not working" / "не работает" describe defects, not bans.
  // Preserve sentence boundaries until constraints have been removed.
  return task.toLowerCase().replaceAll("ё", "е")
    .replace(/\b(?:(?:do not|don['’]?t)\s+(?:use|add|change|touch|create|build|redesign|implement|install|enable|need)|without|no|not(?!\s+(?:working|loading|opening|responding|visible|accessible|only)\b))\b[^.!?;\n]*?(?=\b(?:but|instead)\b|[,;.!?\n]|$)/gu, " ")
    .replace(/(?:^|\s)(?:без\s+|не\s+(?:использ\p{L}*|дела\p{L}*|добав\p{L}*|меня\p{L}*|трога\p{L}*|созда\p{L}*|переписыва\p{L}*|подключа\p{L}*|нуж\p{L}*|надо)\s+)[^.!?;\n]*?(?=\s+(?:но|а)\s|[,;.!?\n]|$)/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function isReviewOnly(task: string) {
  return /\b(?:review only|audit only|only (?:review|audit|check)|no (?:code )?changes|without (?:any )?(?:code )?(?:changes|edits))\b|\bdo not edit(?: code| anything)?(?:[,.!?;]|$)|только (?:ревью|провер|аудит)|без (?:правок|изменений)|ничего не меняй|не меняй код|код не меняй/iu.test(task);
}

function hasCreationAction(text: string) {
  // "Make a review" and "сделай ревью" request an audit, not new UI.
  return create.test(text
    .replace(/\b(?:make|create|do|perform) (?:a |an |the )?(?:review|audit|check)\b/gu, " ")
    .replace(/(?:сделай|сделать|создай|создать) (?:ревью|аудит|проверку)/gu, " "));
}

function hasSuppliedReference(text: string) {
  return /\b(?:from|match|recreate|replicate)\b.*\b(?:mockup|screenshot|figma|reference)\b|\b(?:supplied|attached|provided) (?:figma )?(?:mockup|screenshot|reference)\b|по (?:приложенн\p{L}* |предоставленн\p{L}* )?(?:макет|скриншот|референс)|на основе (?:макет|скриншот)/u.test(text);
}

export function recommendForTask(task: string): TaskRecommendation[] {
  const text = positiveTaskText(task);
  const hasScreen = screen.test(text);
  const needsAccessibility = accessible.test(text);
  const needsPerformance = vital.test(text) || pagePerformance.test(text)
    || (hasScreen && /\bperformance\b|производительност/u.test(text));
  const needsDocs = (publicDependency.test(text) || (library.test(text) && !privateDependency.test(text)))
    && (docs.test(text) || /\bcontext7\b/u.test(text));
  const visualPolish = polish.test(text) && !needsAccessibility && !needsPerformance && !needsDocs;
  const needsDesign = (hasScreen || crm.test(text)) && !isReviewOnly(task)
    && (hasCreationAction(text) || visualPolish
      || (desire.test(text) && !review.test(text) && !needsAccessibility && !needsPerformance && !needsDocs));
  const needsBrowserReview = (review.test(text) && (hasScreen || browser.test(text) || needsAccessibility))
    || (hasScreen && change.test(text) && !needsDesign);
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
  else if (needsPerformance) add("performance", "Helps measure and improve page loading and JavaScript bundle size.");
  if (needsPerformance && /\b(?:react|next js)\b/u.test(text)) {
    add("vercel-react-best-practices", "Provides React and Next.js patterns for reducing client JavaScript and unnecessary rendering.");
  }
  if (animation.test(text)) {
    if (motionPerformance.test(text)) add("fixing-motion-performance", "Helps diagnose animation jank and unnecessary rendering work.");
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
  if (review.test(text) && /\b(?:architecture|codebase|code quality)\b|архитектур|качеств\p{L}* код/u.test(text)) {
    add("antivibe", "Guides an evidence-based review of code structure, architecture and maintainability.");
  }

  if (registry.test(text) && !needsDocs) {
    add("shadcn", "Helps work with shadcn components and registries when the project is configured for them.");
    add("shadcn-mcp", "Finds matching components and examples in the configured shadcn registry.");
  }

  // Add one design helper after explicit specialist requests. Existing project
  // components and conventions remain authoritative in all three workflows.
  if (needsDesign) {
    if (hasSuppliedReference(text)) add("build-design", "Implements the supplied visual reference using the project's existing components and design conventions.");
    else if (visualPolish) add("baseline-ui", "Refines spacing, typography and visual hierarchy while preserving the existing design system and MTKit components.");
    else add("ui-ux-pro-max", "Helps resolve layout, UX and responsive behavior within the project's existing design system and MTKit components.");
  }

  if (needsBrowserReview || needsAccessibility || needsDesign) add("playwright", "Runs the interface in a browser to verify the relevant workflow, viewport and keyboard behavior.", companions);
  if (needsDocs) add("context7", "Retrieves public library documentation and version-sensitive API examples.", companions);
  if (needsPerformance || (/\bchrome\b|браузер/u.test(text) && /\b(?:network|console|requests|errors)\b|консол|запрос|ошибк/u.test(text))) {
    add("chrome-devtools", "Inspects browser performance, console output and network requests; requires the optional Chrome DevTools MCP.", companions);
  }
  if (/\bnext js\b/u.test(text) && /\b(?:dev server|errors|logs|routes|runtime)\b|ошибк|лог|маршрут/u.test(text)) {
    add("next-devtools", "Inspects errors, routes and logs in a running Next.js 16+ app; requires the optional Next.js DevTools MCP.", companions);
  }
  return [...recommendations.slice(0, recommendationLimit - companions.length), ...companions];
}

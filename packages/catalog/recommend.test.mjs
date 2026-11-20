import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: [fileURLToPath(new URL("./index.ts", import.meta.url))],
  bundle: true, platform: "node", format: "esm", write: false,
});
const { recommendForTask, queryCatalog, getEntry, ruleRoutedIds } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString("base64")}`
);

// User tasks, including constraints and unsupported domains, rather than copies
// of matching expressions. Keep these readable so routing changes are reviewable.
const cases = [
  ["Сделай мини CRM для поставщиков", ["design-screen", "ui-ux-pro-max", "playwright"]],
  ["Хочу мини CRM для поставщиков", ["design-screen", "ui-ux-pro-max", "playwright"]],
  ["Build a supplier management dashboard", ["design-screen", "playwright"]],
  ["Please design a page for suppliers", ["design-screen", "ui-ux-pro-max", "playwright"]],
  ["Can you design our dashboard?", ["design-screen", "ui-ux-pro-max", "playwright"]],
  ["Добавь модальное окно редактирования поставщика", ["design-screen", "playwright"]],
  ["Причеши страницу как работать, используй нормальную ширину", ["design-screen", "baseline-ui", "playwright"]],
  ["Polish the layout of our onboarding page", ["design-screen", "baseline-ui", "playwright"]],
  ["Улучши интерфейс страницы профиля", ["design-screen", "baseline-ui", "playwright"]],
  ["Improve the existing screen layout", ["design-screen", "baseline-ui", "playwright"]],
  ["Сверстай экран по приложенному скриншоту", ["design-screen", "build-design", "playwright"], ["ui-ux-pro-max"]],
  ["Build the page from the supplied Figma mockup", ["design-screen", "build-design", "playwright"], ["ui-ux-pro-max"]],
  ["Create a mockup for a supplier CRM", ["design-screen", "ui-ux-pro-max"], ["build-design"]],
  ["Проверь экран на телефоне и desktop", ["review-screen", "playwright"], ["design-screen"]],
  ["Не делай редизайн страницы. Только проверь ее доступность", ["review-screen", "accessibility", "playwright"], ["design-screen"]],
  ["Review the existing screen. Do not redesign or create new UI", ["review-screen", "playwright"], ["design-screen"]],
  ["Хочу проверить страницу. Только ревью", ["review-screen", "playwright"], ["design-screen", "ui-ux-pro-max", "baseline-ui"]],
  ["Сделай ревью формы", ["review-screen", "playwright"], ["design-screen", "ui-ux-pro-max"]],
  ["I want a review of this screen, do not edit", ["review-screen", "playwright"], ["design-screen"]],
  ["Make a review of the page", ["review-screen", "playwright"], ["design-screen"]],
  ["Review the design of this page", ["review-screen", "playwright"], ["design-screen"]],
  ["Нужно улучшить доступность формы", ["review-screen", "fixing-accessibility", "playwright"], ["design-screen", "baseline-ui"]],
  ["Исправь форму, она не работает на телефоне", ["review-screen", "playwright"]],
  ["The submit button is not working. Check the page", ["review-screen", "playwright"]],
  ["Почини навигацию с клавиатуры в диалоге", ["review-screen", "fixing-accessibility", "playwright"]],
  ["Audit keyboard navigation and WCAG compliance", ["review-screen", "accessibility", "playwright"]],
  ["Найди документацию React useEffect", ["library-docs", "context7"]],
  ["How do I use TanStack Query?", ["library-docs", "context7"]],
  ["Нужна документация библиотеки date-fns", ["library-docs", "context7"]],
  ["Find the official API docs for the Hono library", ["library-docs", "context7"]],
  ["Найди документацию закрытого @mtkit/ui", [], ["context7"]],
  ["Уменьши бандл React приложения", ["performance", "vercel-react-best-practices"]],
  ["Reduce the JavaScript bundle size of our React app", ["performance", "vercel-react-best-practices"]],
  ["Improve the performance of this page", ["performance", "chrome-devtools"], ["design-screen", "baseline-ui"]],
  ["Проверь LCP и CLS страницы", ["core-web-vitals", "chrome-devtools"]],
  ["Diagnose failed network requests in Chrome", ["chrome-devtools"]],
  ["Разберись с ошибками dev сервера Next.js", ["next-devtools"]],
  ["Нужна анимация появления диалога на GSAP в React", ["gsap-react"]],
  ["Проверь рывки анимации при прокрутке", ["fixing-motion-performance"]],
  ["Сделай страницу без GSAP и анимаций", ["design-screen", "playwright"], ["gsap-core", "gsap-react", "review-animations"]],
  ["Build a dashboard without GSAP animations", ["design-screen", "playwright"], ["gsap-core", "gsap-react"]],
  ["Use shadcn to add a form", ["shadcn", "shadcn-mcp", "design-screen"]],
  ["Используй MTKit, не используй shadcn. Сделай форму", ["design-screen", "playwright"], ["shadcn", "shadcn-mcp"]],
  ["Систематизируй токены темы и цвета", ["design-system"]],
  ["Подбери палитру для CRM", ["color-expert"]],
  ["Проверь SEO страницы", ["seo"]],
  ["Аудит архитектуры TypeScript проекта", ["antivibe"], ["design-screen", "playwright"]],
  ["Build a CRM screen, verify keyboard access, and check the React API docs", ["design-screen", "review-screen", "library-docs", "playwright", "context7"]],
  ["Переведи описание договора на английский", []],
  ["Закажи кофе и найди ресторан", []],
  ["Напиши документацию процесса закупок", []],
  ["Create a PostgreSQL database migration", []],
  ["Не используй GSAP", []],
  ["Не нужен GSAP. Проверь страницу", ["review-screen", "playwright"], ["gsap-core", "gsap-react"]],
  ["Build a page with React but not GSAP", ["design-screen", "playwright"], ["gsap-core", "gsap-react"]],
  ["I don't know how to use React hooks", ["library-docs", "context7"]],
  ["Не знаю, как использовать React hooks", ["library-docs", "context7"]],
  // No curated rule covers these: entries are ranked by their own name and tags.
  ["Сделай презентацию PowerPoint по итогам квартала", ["pptx"]],
  ["Build an Excel spreadsheet with formulas", ["xlsx"]],
  ["Добавь анимацию при прокрутке на GSAP", ["gsap-core", "gsap-scrolltrigger"]],
  ["Write e2e browser tests from the terminal", ["playwright-cli"]],
  ["Найди регрессию: нужен тест на баг", ["regression-proof"]],
  ["Сделай презентацию без PowerPoint, просто текстом", [], ["pptx"]],
];

test("ranking leaves entries routed by rules to the rules", async () => {
  const source = await readFile(new URL("./recommend.ts", import.meta.url), "utf8");
  const added = new Set([...source.matchAll(/\badd\("([a-z0-9-]+)"/g)].map(([, id]) => id));
  assert.deepEqual([...added].sort(), [...ruleRoutedIds].sort());
  // Matching tags ("экран", "react") must not bring back design-screen for a review task.
  const ids = recommendForTask("Проверь доступность React-экрана на телефоне и с клавиатуры").map(({ entry }) => entry.id);
  assert(!ids.includes("design-screen"), ids.join(", "));
});

test("rule matches come first and ranked matches say how they were found", () => {
  const recommendations = recommendForTask("Добавь анимацию при прокрутке на GSAP");
  const matches = recommendations.map(({ entry, match }) => `${entry.id}:${match}`);
  assert.deepEqual(matches.slice(0, 1), ["gsap-core:rule"]);
  const ranked = recommendations.find(({ entry }) => entry.id === "gsap-scrolltrigger");
  assert.equal(ranked.match, "tags");
  assert.match(ranked.reason, /прокрутке/);
});

for (const [task, expected, excluded = []] of cases) {
  test(task, () => {
    const recommendations = recommendForTask(task);
    const ids = recommendations.map(({ entry }) => entry.id);
    if (!expected.length) assert.deepEqual(ids, [], task);
    for (const id of expected) assert(ids.includes(id), `Missing ${id}: ${ids.join(", ")}`);
    for (const id of excluded) assert(!ids.includes(id), `Excluded ${id}: ${ids.join(", ")}`);
    assert(ids.length <= 6);
    assert.equal(new Set(ids).size, ids.length);
    for (const { entry, reason } of recommendations) {
      assert.deepEqual(entry, getEntry(entry.id));
      assert(reason.trim());
    }
  });
}

test("catalog identifiers and names are discoverable with client kind filters", () => {
  for (const [query, kind, expected] of [
    ["Next.js DevTools", "mcp", "next-devtools"],
    ["chrome-devtools", "mcp", "chrome-devtools"],
    ["документация React", "mcp", "context7"],
    ["доступность", "skill", "accessibility"],
    ["shadcn", "skill", "shadcn"],
  ]) {
    const result = queryCatalog({ query, kind, limit: 10 });
    assert(result.entries.some(({ id }) => id === expected), query);
    assert(result.entries.every(entry => entry.kind === kind));
  }
});

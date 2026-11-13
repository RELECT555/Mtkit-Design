import externalSources from "./external-skills.json";
import type { CatalogEntry } from "./types.js";

const category = {
  design: "Интерфейсы",
  system: "Дизайн-система",
  testing: "Тестирование",
  react: "React и Next.js",
  motion: "Анимация",
  quality: "Качество веба",
  process: "Процессы",
  documents: "Документы",
  docs: "Документация",
  infra: "Инфраструктура",
} as const;

type Metadata = readonly [
  category: keyof typeof category,
  description: string,
  tags?: readonly string[],
  prerequisites?: readonly string[],
];

const descriptions: Partial<Record<string, Metadata>> = {
  "unlazy": ["process", "Ведёт объёмную задачу через контрольные точки и проверку результата.", ["completion", "довести до конца", "проверка"]],
  "antivibe": ["process", "Помогает разобрать архитектуру и качество существующего кода.", ["code review", "аудит кода", "архитектура"]],
  "agent-interface-design": ["process", "Проектирует CLI, инструменты и API для агентов.", ["agent tools", "mcp", "cli", "инструменты"]],
  "assumption-test": ["testing", "Проверяет техническое предположение небольшим экспериментом.", ["experiments", "гипотеза", "интеграция"]],
  "blindspot-pass": ["process", "Выявляет риски и неизвестные перед работой в незнакомой области.", ["discovery", "риски", "требования"]],
  "brainstorm-prototypes": ["design", "Готовит разные варианты решения для сравнения.", ["prototyping", "идеи", "варианты"]],
  "change-quiz": ["process", "Проверяет понимание сделанных изменений перед слиянием.", ["merge", "ревью", "проверка"]],
  "context-audit": ["process", "Находит повторы и противоречия в инструкциях для агента.", ["agents.md", "claude.md", "аудит инструкций"]],
  "implementation-notes": ["process", "Фиксирует решения и отклонения при реализации плана.", ["change log", "журнал изменений"]],
  "implementation-plan": ["process", "Оформляет план реализации и открытые решения.", ["planning", "план", "архитектура"]],
  "interview-me": ["process", "Уточняет требования и решения перед реализацией.", ["requirements", "уточнение", "интервью"]],
  "pitch-packager": ["documents", "Собирает материалы проекта в один документ для ревью.", ["handoff", "спецификация", "предложение"]],
  "progressive-disclosure": ["process", "Разбивает длинные инструкции на краткий вход и тематические справки.", ["agents.md", "контекст", "инструкции"]],
  "reference-hunt": ["process", "Извлекает требования и шаблоны из существующих реализаций.", ["reference", "референс", "сравнение реализации"]],
  "regression-proof": ["testing", "Проверяет исправление тестом, который выявлял исходную ошибку.", ["regression", "баг", "тесты", "регрессия"]],
  "test-blindspots": ["testing", "Находит важные сценарии, которые не покрывает существующий набор тестов.", ["coverage", "покрытие", "тесты"]],
  "frontend-design": ["design", "Проектирует выразительный интерфейс и переносит его в код.", ["frontend", "typescript", "верстка", "дизайн"]],
  "docx": ["documents", "Создаёт, читает и редактирует документы Word.", ["word", "текстовый документ"]],
  "pdf": ["documents", "Извлекает содержимое и работает со страницами PDF.", ["extract", "извлечение", "документ"]],
  "pptx": ["documents", "Создаёт и редактирует презентации PowerPoint.", ["powerpoint", "слайды", "презентация"]],
  "xlsx": ["documents", "Работает с таблицами Excel, формулами и форматированием.", ["excel", "таблицы", "формулы"]],
  "shadcn": ["system", "Добавляет и настраивает компоненты из реестров shadcn/ui.", ["react", "tailwind", "registry", "компоненты"], ["Проект shadcn/ui с components.json для работы с реестрами"]],
  "improve": ["process", "Проводит аудит кода и формирует приоритетный план улучшений.", ["architecture", "code quality", "аудит", "рефакторинг"]],
  "claude-dual-review-file-based": ["process", "Ведёт файловый цикл ревью с независимым проверяющим.", ["review", "claude", "ревью"], ["Независимый проверяющий для проведения раундов"]],
  "ui-ux-pro-max": ["design", "Помогает выбрать визуальное направление, компоновку и решения UX.", ["ux", "responsive", "дизайн", "доступность", "адаптивность"], ["Python 3 для поискового скрипта"]],
  "design-system": ["system", "Проектирует токены, компоненты и правила дизайн-системы.", ["tokens", "components", "цвет", "дизайн-система"]],
  "ui-styling": ["system", "Помогает оформлять интерфейс на shadcn и Tailwind CSS.", ["tailwind", "css", "стили", "компоненты"]],
  "design-taste-frontend": ["design", "Помогает подобрать визуальный язык и композицию для публичных страниц.", ["marketing", "landing", "визуальный стиль", "лендинг"], ["Node.js 22 или новее для вспомогательного скрипта"]],
  "hallmark": ["design", "Проектирует новую страницу с опорой на визуальные материалы и задачу пользователя.", ["visual direction", "новая страница", "лендинг", "дизайн"]],
  "impeccable": ["design", "Проверяет и дорабатывает интерфейс с учётом контекста продукта.", ["visual quality", "полировка", "редизайн", "дизайн"]],
  "playwright-cli": ["testing", "Навигирует по сайту и проверяет интерфейс из терминала.", ["browser", "e2e", "snapshot", "браузер", "скриншоты", "тесты"], ["@playwright/cli для запуска команд"]],
  "emil-design-eng": ["design", "Дорабатывает взаимодействия, состояния и детали компонентов.", ["interaction", "motion", "полировка", "анимация"]],
  "review-animations": ["motion", "Проверяет анимацию, переходы и связь движения с действием пользователя.", ["motion review", "ревью анимаций", "переходы"]],
  "improve-animations": ["motion", "Предлагает план доработки существующей анимации.", ["motion polish", "плавность", "улучшения"]],
  "find-animation-opportunities": ["motion", "Находит места, где движение помогает понять интерфейс.", ["motion", "переходы", "интеракции"]],
  "mobile-native": ["design", "Дорабатывает мобильное взаимодействие, жесты и поведение браузера.", ["mobile", "touch", "телефон", "жесты", "адаптивность"]],
  "pick-ui-library": ["system", "Подбирает библиотеку под конкретную задачу интерфейса.", ["components", "react", "выбор библиотеки"]],
  "break-ui": ["testing", "Проверяет интерфейс длинными строками, пропущенными полями и крайними значениями.", ["edge cases", "верстка", "переполнение", "тесты"]],
  "prototype": ["design", "Показывает интерактивные варианты интерфейса для сравнения.", ["варианты", "прототип", "prototyping"]],
  "web-quality-audit": ["quality", "Оценивает производительность, доступность и SEO сайта.", ["audit", "аудит", "доступность", "производительность"]],
  "accessibility": ["quality", "Проверяет доступность по WCAG, клавиатуру и скринридеры.", ["a11y", "wcag", "доступность", "фокус", "клавиатура"]],
  "performance": ["quality", "Измеряет и улучшает скорость загрузки и отклик веб-приложения.", ["lighthouse", "скорость", "производительность", "загрузка"]],
  "core-web-vitals": ["quality", "Проверяет LCP, INP и CLS и помогает устранить причины отклонений.", ["lcp", "inp", "cls", "производительность", "метрики"]],
  "seo": ["quality", "Проверяет индексацию, метаданные и структурированные данные.", ["search engines", "поисковая оптимизация", "индексация"]],
  "vercel-react-best-practices": ["react", "Помогает писать React и Next.js код с учётом загрузки данных и размера бандла.", ["typescript", "next.js", "bundle", "производительность", "react"]],
  "vercel-composition-patterns": ["react", "Помогает проектировать API и композицию переиспользуемых React-компонентов.", ["typescript", "react", "props", "компоненты"]],
  "deploy-to-vercel": ["infra", "Описывает подготовку и запуск развёртывания на Vercel.", ["next.js", "deploy", "деплой", "хостинг"]],
  "color-expert": ["system", "Подбирает палитры и проверяет цветовые пространства, градиенты и контраст.", ["color", "palette", "цвет", "контраст", "палитра"]],
  "gsap-core": ["motion", "Показывает базовые операции GSAP и жизненный цикл анимации.", ["gsap", "tween", "анимация"]],
  "gsap-react": ["motion", "Интегрирует GSAP с React через useGSAP и очистку эффектов.", ["gsap", "react", "typescript", "анимация"]],
  "gsap-timeline": ["motion", "Собирает последовательности GSAP через timelines и метки.", ["gsap", "timeline", "анимация", "последовательность"]],
  "gsap-scrolltrigger": ["motion", "Настраивает GSAP-анимацию, привязанную к прокрутке.", ["gsap", "scroll", "анимация", "прокрутка"]],
  "gsap-performance": ["motion", "Улучшает производительность анимации GSAP.", ["gsap", "fps", "анимация", "производительность"]],
  "gsap-plugins": ["motion", "Помогает подключить и использовать плагины GSAP.", ["gsap", "plugins", "анимация", "плагины"]],
  "gsap-utils": ["motion", "Подбирает утилиты GSAP для чисел, диапазонов и преобразований.", ["gsap", "utilities", "анимация"]],
  "gsap-frameworks": ["motion", "Разбирает интеграцию GSAP с компонентными фреймворками.", ["gsap", "frameworks", "анимация"]],
  "baseline-ui": ["design", "Проверяет базовые детали UI, включая отступы, типографику и выравнивание.", ["polish", "верстка", "типографика"]],
  "improve-ui": ["design", "Аудирует интерфейс и описывает план доработок с опорой на наблюдения.", ["ui audit", "аудит интерфейса", "план"]],
  "fixing-accessibility": ["quality", "Исправляет проблемы клавиатуры, фокуса, семантики и форм.", ["a11y", "aria", "доступность", "клавиатура"]],
  "fixing-metadata": ["quality", "Проверяет и обновляет заголовки, Open Graph и структурированные данные.", ["seo", "open graph", "метаданные"]],
  "fixing-motion-performance": ["motion", "Находит причины рывков и лишней работы при анимации.", ["fps", "jank", "анимация", "производительность"]],
  "make-interfaces-feel-better": ["design", "Дорабатывает визуальные и интерактивные детали компонентов.", ["polish", "типографика", "иконки", "полировка"]],
  "clean": ["design", "Подбирает визуальный язык с простыми формами, читаемым текстом и свободным пространством.", ["art direction", "минимализм", "стиль"]],
  "contemporary": ["design", "Предлагает современное направление с модульной компоновкой.", ["art direction", "современный", "стиль"]],
  "editorial": ["design", "Использует редакционную композицию и выразительную типографику.", ["art direction", "типографика", "редакционный стиль"]],
  "minimal": ["design", "Оформляет страницу через сдержанную палитру и визуальную иерархию.", ["art direction", "минимализм", "стиль"]],
  "premium": ["design", "Предлагает визуальное направление с точными отступами и вниманием к материалам.", ["art direction", "премиальный", "стиль"]],
  "professional": ["design", "Предлагает деловое визуальное направление с чёткой структурой.", ["art direction", "деловой", "стиль"]],
  "sleek": ["design", "Помогает собрать сдержанный интерфейс с акцентом на линии и пропорции.", ["art direction", "современный", "стиль"]],
  "spacious": ["design", "Подбирает просторную компоновку с крупными отступами.", ["art direction", "отступы", "стиль"]],
  "bento": ["design", "Строит композицию на модульной сетке карточек.", ["art direction", "grid", "сетка", "карточки"]],
  "corporate": ["design", "Подбирает визуальные решения для корпоративной среды и бренда.", ["art direction", "корпоративный", "стиль"]],
  "better-interface": ["design", "Проверяет существующий экран по нескольким аспектам качества интерфейса.", ["ui review", "аудит интерфейса", "ревью"]],
  "build-design": ["design", "Переносит макет или скриншот в компоненты проекта.", ["figma", "screenshot", "макет", "скриншот", "верстка"]],
  "variant": ["design", "Собирает отличающиеся варианты компонента или экрана для сравнения.", ["prototyping", "варианты", "прототип"]],
};

const categoryTags: Record<keyof typeof category, readonly string[]> = {
  design: ["ui", "frontend", "интерфейс"],
  system: ["design system", "design tokens", "компоненты"],
  testing: ["testing", "test", "тестирование"],
  react: ["typescript", "react", "next.js"],
  motion: ["animation", "motion", "анимация"],
  quality: ["web quality", "audit", "веб", "качество"],
  process: ["workflow", "engineering", "разработка"],
  documents: ["documents", "документы"],
  docs: ["documentation", "docs", "документация"],
  infra: ["infrastructure", "инструменты", "инфраструктура"],
};

const bundledSkills: readonly CatalogEntry[] = [
  {
    id: "design-screen", kind: "skill", availability: "bundled", name: "design-screen", title: "Проектирование экрана MTKit",
    description: "Проектирует экран Medipal по описанию, макету или интерфейсу существующего приложения.",
    category: category.design, tags: ["mtkit", "typescript", "react", "crm", "срм", "проектирование", "экран", "интерфейс"],
    sourcePath: "plugins/mtkit-design/skills/design-screen/SKILL.md",
    prerequisites: ["Доступ к @mtkit/ui для проверки на компонентах Medipal"],
    access: "Инструкции для агента. Изменения кода выполняются в открытом проекте.",
  },
  {
    id: "review-screen", kind: "skill", availability: "bundled", name: "review-screen", title: "Проверка экрана MTKit",
    description: "Проверяет интерфейс на десктопе и телефоне, включая клавиатуру и основной сценарий.",
    category: category.testing, tags: ["mtkit", "browser", "playwright", "адаптивность", "браузер", "ревью интерфейса"],
    sourcePath: "plugins/mtkit-design/skills/review-screen/SKILL.md",
    prerequisites: ["Запущенный интерфейс и доступ к браузеру"],
    access: "Инструкции для агента. Проверка может использовать браузерные инструменты.",
  },
  {
    id: "library-docs", kind: "skill", availability: "bundled", name: "library-docs", title: "Документация библиотек",
    description: "Уточняет API публичных библиотек через Context7 и сверяет версии с зависимостями проекта.",
    category: category.docs, tags: ["context7", "typescript", "api", "react", "справка", "документация", "библиотеки"],
    sourcePath: "plugins/mtkit-design/skills/library-docs/SKILL.md",
    prerequisites: ["Context7 для поиска документации публичных библиотек"],
    access: "Инструкции для агента. Для Context7 используются названия публичных библиотек и общие вопросы об API.",
  },
];

const mcpEntries: readonly CatalogEntry[] = [
  {
    id: "context7", kind: "mcp", availability: "bundled", name: "context7", title: "Context7",
    description: "Ищет актуальную документацию, примеры кода и API публичных библиотек.",
    category: category.docs, tags: ["documentation", "typescript", "react", "next.js", "документация", "библиотеки", "api"],
    sourceUrl: "https://context7.com/docs/installation",
    prerequisites: ["Сетевой доступ к mcp.context7.com"],
    access: "Запросы отправляются внешнему сервису. Подходит для публичной документации.",
  },
  {
    id: "shadcn-mcp", kind: "mcp", availability: "bundled", name: "shadcn", title: "shadcn MCP",
    description: "Ищет компоненты, примеры и конфигурацию в реестрах shadcn/ui.",
    category: category.system, tags: ["react", "typescript", "tailwind", "registry", "компоненты", "реестр"],
    sourceUrl: "https://ui.shadcn.com/docs/mcp",
    prerequisites: ["Node.js и npm", "Доступ к реестру компонентов проекта"],
    access: "Локальный процесс с доступом к конфигурации проекта и его реестрам shadcn.",
    revision: "4.23.0",
  },
  {
    id: "playwright", kind: "mcp", availability: "bundled", name: "playwright", title: "Playwright MCP",
    description: "Открывает страницы в браузере для проверки взаимодействий, адаптива и снимков экрана.",
    category: category.testing, tags: ["browser", "e2e", "testing", "скриншоты", "браузер", "тесты", "автоматизация"],
    sourceUrl: "https://playwright.dev/docs/getting-started-mcp",
    prerequisites: ["Node.js и npm", "Браузер Playwright"],
    access: "Управляет изолированной браузерной сессией, включая клики и ввод на открытой странице.",
    revision: "0.0.85",
  },
  {
    id: "mtkit-catalog", kind: "mcp", availability: "bundled", name: "mtkit_catalog", title: "MTKit Catalog",
    description: "Ищет навыки и MCP-серверы для стека Medipal и готовит план установки для выбранного агента.",
    category: category.infra, tags: ["mtkit", "catalog", "typescript", "skills", "каталог", "поиск", "установка"],
    sourcePath: "packages/mcp/server.ts",
    prerequisites: ["Локальная копия репозитория MTKit Design", "Node.js 22.12+, npm и tar"],
    access: "Читает каталог и возвращает инструкции по установке.",
  },
  {
    id: "next-devtools", kind: "mcp", availability: "optional", name: "next_devtools", title: "Next.js DevTools",
    description: "Показывает маршруты, ошибки сборки и логи локального сервера Next.js.",
    category: category.react, tags: ["next.js", "react", "typescript", "runtime", "ошибки", "маршруты", "диагностика"],
    sourceUrl: "https://nextjs.org/docs/app/guides/mcp",
    prerequisites: ["Node.js и npm", "Запущенный dev-сервер Next.js 16+ для диагностики приложения"],
    access: "Локальный процесс может читать маршруты и логи dev-сервера Next.js.",
    revision: "0.4.0",
  },
  {
    id: "chrome-devtools", kind: "mcp", availability: "optional", name: "chrome_devtools", title: "Chrome DevTools MCP",
    description: "Проверяет консоль, сетевые запросы и производительность страницы в Chrome.",
    category: category.testing, tags: ["browser", "network", "performance", "браузер", "консоль", "сеть", "производительность"],
    sourceUrl: "https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/client-configurations.md",
    prerequisites: ["Node.js 22.12+ и npm", "Установленный Chrome"],
    access: "Запускает отдельный профиль Chrome и видит данные открытых в нём страниц.",
    revision: "1.13.0",
  },
];

function titleFromName(name: string) {
  return name.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

const externalSkills: CatalogEntry[] = externalSources.flatMap(source =>
  Object.entries(source.skills).map(([name, path]) => {
    const [group, description, tags = [], prerequisites = []] = descriptions[name] ?? [
      "process",
      `Навык из репозитория ${source.repository}. Подробности доступны в исходном SKILL.md.`,
    ];
    const sourcePath = path === "." ? "SKILL.md" : `${path}/SKILL.md`;
    return {
      id: name,
      kind: "skill",
      availability: "bundled",
      name,
      title: titleFromName(name),
      description,
      category: category[group],
      tags: [...new Set([...tags, ...categoryTags[group]])],
      prerequisites,
      sourceUrl: `https://github.com/${source.repository}/blob/${source.revision}/${sourcePath}`,
      access: "Инструкции и вспомогательные файлы. Возможности зависят от инструментов, которые использует навык.",
      revision: source.revision,
    };
  }),
);

export const catalogEntries: readonly CatalogEntry[] = [...bundledSkills, ...mcpEntries, ...externalSkills];
export const catalogCategories = Object.values(category).sort((a, b) => a.localeCompare(b, "ru"));

const skillsCount = catalogEntries.filter(entry => entry.kind === "skill").length;
const bundledCount = catalogEntries.filter(entry => entry.availability === "bundled").length;
export const catalogCounts = {
  total: catalogEntries.length,
  skills: skillsCount,
  mcp: catalogEntries.length - skillsCount,
  bundled: bundledCount,
  bundledMcp: mcpEntries.filter(entry => entry.availability === "bundled").length,
  optional: catalogEntries.length - bundledCount,
} as const;

const byId = new Map(catalogEntries.map(entry => [entry.id, entry]));

export function getEntry(id: string) {
  return byId.get(id.trim().toLowerCase());
}

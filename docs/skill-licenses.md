# Лицензии внешних навыков

MCP-сервер раздаёт файлы навыков через `install_skills` и архивы `/skills/<id>.tar.gz`. Это распространение чужого кода, поэтому у каждого источника в [external-skills.json](../packages/catalog/external-skills.json) записана лицензия. `npm run catalog:inventory` не пропустит источник без этого поля.

- Строка с SPDX-идентификатором разрешает серверу отдавать файлы навыка. Архив содержит файл лицензии из репозитория, если он лежит в папке навыка.
- `null` означает, что источник проверен и лицензии нет. Такой навык не попадает в пакет сервера и не отдаётся архивом. Агент может прочитать его инструкции через `get_skill` и предложить установку из исходного репозитория.

Проверено 2026-11-19 по файлам LICENSE на закреплённых ревизиях. Для `vercel-labs/agent-skills` файла LICENSE нет, MIT указана в README и во frontmatter навыков. Для `anthropics/skills` лицензия лежит в папке каждого навыка.

| Репозиторий | Лицензия | Навыки |
| --- | --- | --- |
| [Leonxlnx/unlazy](https://github.com/Leonxlnx/unlazy/tree/16671491f6679ad9378f52604d3bc2415b4120c7) | MIT | unlazy |
| [mohi-devhub/antivibe](https://github.com/mohi-devhub/antivibe/tree/9991d12ec52bc0b90eeab893fef27398be1ef616) | MIT | antivibe |
| [Neeeophytee/finding-unknowns-skills](https://github.com/Neeeophytee/finding-unknowns-skills/tree/ca5696a0f08d2de6b2997fff1d6cc05c3ed587cc) | MIT | agent-interface-design, assumption-test, blindspot-pass, brainstorm-prototypes, change-quiz, context-audit, implementation-notes, implementation-plan, interview-me, pitch-packager, progressive-disclosure, reference-hunt, regression-proof, test-blindspots |
| [anthropics/skills](https://github.com/anthropics/skills/tree/2c5958ecac7cee2b583967a2c4981d0f4a75c579) | Apache-2.0 | frontend-design, docx, pdf, pptx, xlsx |
| [shadcn/ui](https://github.com/shadcn/ui/tree/dd41d19e2f80ff6891951f7ced74c2c9a650b065) | MIT | shadcn |
| [shadcn/improve](https://github.com/shadcn/improve/tree/cac56e1ebd3c279aa9153616cfeac7b174ab90f9) | MIT | improve |
| [Serg2000Mr/dual-review-file-based](https://github.com/Serg2000Mr/dual-review-file-based/tree/633f07629f30379566f7da7e13be32ab9eff35ec) | **нет лицензии** | claude-dual-review-file-based |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/6ae86f61f520d6ca229d2f40e070410638c908c5) | MIT | ui-ux-pro-max, design-system, ui-styling |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill/tree/f6b76575f949707b4e3c37cd86cb44b0b98643e8) | MIT | design-taste-frontend |
| [nutlope/hallmark](https://github.com/nutlope/hallmark/tree/04977e15f3dfd6ee4b74c887dac3eb52665d6c92) | MIT | hallmark |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable/tree/c4cd1924c389f68d37c687d9c2bbf13f12547c41) | Apache-2.0 | impeccable |
| [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli/tree/b21724888b8100b05ef8dee3a92f2bb03bf4dcde) | Apache-2.0 | playwright-cli |
| [emilkowalski/skills](https://github.com/emilkowalski/skills/tree/f7ce8c02d6e3c8f0d980a44c57bcc41a40254349) | MIT | emil-design-eng, review-animations, improve-animations, find-animation-opportunities, mobile-native, pick-ui-library, break-ui, prototype |
| [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills/tree/afa8da942115f2961fdbfa80807ea0b232ff6c00) | MIT | web-quality-audit, accessibility, performance, core-web-vitals, seo |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62) | MIT | vercel-react-best-practices, vercel-composition-patterns, deploy-to-vercel |
| [meodai/skill.color-expert](https://github.com/meodai/skill.color-expert/tree/5bf7c7704d56bccc6aeea38c36bcf449abe56a6c) | CC-BY-4.0 | color-expert |
| [greensock/gsap-skills](https://github.com/greensock/gsap-skills/tree/aed9cfd3277740755f6bfc1155c7aa645403b760) | MIT | gsap-core, gsap-react, gsap-timeline, gsap-scrolltrigger, gsap-performance, gsap-plugins, gsap-utils, gsap-frameworks |
| [ibelick/ui-skills](https://github.com/ibelick/ui-skills/tree/ba966a3aaa4080ab1836d350f3131584e2d4243a) | MIT | baseline-ui, improve-ui, fixing-accessibility, fixing-metadata, fixing-motion-performance |
| [jakubkrehel/make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better/tree/35545ea1512ad59fa463e6b1f95ca9c052981fe6) | MIT | make-interfaces-feel-better |
| [bergside/awesome-design-skills](https://github.com/bergside/awesome-design-skills/tree/f631a09b4fcc0166f2e2c1a8c81906ef680c57e8) | MIT | clean, contemporary, editorial, minimal, premium, professional, sleek, spacious, bento, corporate |
| [jakubkrehel/skills](https://github.com/jakubkrehel/skills/tree/a72290d140249813898ba8648becf6415abcb059) | MIT | better-interface, build-design, variant |

## Что проверить юристам

- **CC-BY-4.0** (`color-expert`) требует указания авторства. Файл LICENSE с авторством входит в архив навыка.
- **Сторонние материалы внутри навыков.** `design-taste-frontend` содержит фотографии с Unsplash и Wikimedia Commons с собственными лицензиями (перечислены в `assets/photos/photos.json`) и логотипы брендов в `assets/icons`. Логотипы — товарные знаки: их использование в продуктах команды стоит согласовать отдельно.
- **Обновление ревизий.** При смене ревизии лицензия может поменяться. Проверяйте файл LICENSE заново при каждом обновлении `external-skills.json`.

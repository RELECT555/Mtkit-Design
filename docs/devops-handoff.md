# Передача MTKit Design в Azure Repos

Сайт, MCP и плагин Codex находятся в одном репозитории. Сайт и MCP разворачиваются отдельно. Для одного релиза используйте один коммит `main`.

## 1. Создайте репозиторий в Azure DevOps

В корпоративном проекте Azure DevOps создайте пустой Git-репозиторий `mtkit-design`. В форме создания снимите флажок **Add a README** и оставьте `.gitignore` пустым. Скопируйте HTTPS URL из окна **Clone**. Для загрузки ветки `main` нужна учётная запись с правом записи в репозиторий. [Инструкция Azure Repos](https://learn.microsoft.com/en-us/azure/devops/repos/git/creatingrepo#connect-a-local-git-repo-to-an-azure-repos-git-repo)

## 2. Получите исходники

Если у вас есть доступ к закрытому репозиторию на GitHub, клонируйте `main`.

```bash
git clone --branch main https://github.com/RELECT555/Mtkit-Design.git mtkit-design
```

Если вам передали Git-бандл, выполните команды из папки с файлом. Подставьте точное имя полученного `.bundle`. Бандл содержит полную историю `main` и позволяет клонировать её без доступа к GitHub.

```bash
git bundle list-heads "mtkit-design-<commit>.bundle"
git clone --branch main "mtkit-design-<commit>.bundle" mtkit-design
```

## 3. Загрузите `main` в Azure Repos

Замените `<HTTPS URL Azure Repos>` на скопированный URL. Сравните SHA из двух последних команд. В настройках репозитория проверьте, что `main` выбрана веткой по умолчанию.

```bash
cd mtkit-design
git remote set-url origin "<HTTPS URL Azure Repos>"
git push -u origin main
git rev-parse HEAD
git ls-remote --exit-code origin refs/heads/main
```

## 4. Разверните сайт и MCP

1. Запустите MCP из корневого `Dockerfile` на корпоративном сервере и проверьте HTTPS-адрес `/mcp` из рабочей сети. [Инструкция по MCP](deploy-mcp.md)
2. Создайте пайплайн сайта по шаблону `deploy/azure-static-web-app.yml`. Дайте Build Service доступ на чтение `mt-packages`, добавьте секрет `staticWebAppDeploymentToken` и передайте HTTPS-адрес MCP в параметре `mtkitMcpUrl`. [Инструкция по сайту](deploy-web.md)
3. Откройте каталог на сайте и подключите MCP из Codex. Проверьте поиск, карточку Playwright и план установки. Передайте команде URL репозитория, сайта и MCP, а также SHA развёрнутого коммита.

При сборке сайта npm скачивает `@mtkit/ui` из `mt-packages`. MCP отдаёт карточки и планы установки. Навыки скачивает установщик плагина из закреплённых ревизий, а UI Kit в рабочем проекте устанавливается через npm с доступом к feed. [Установка плагина](../README.md#установка-плагина-codex) · [Подключение UI Kit](../README.md#подключение-пакетов-к-приложению)

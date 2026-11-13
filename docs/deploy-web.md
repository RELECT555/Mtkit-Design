# Публикация веб-приложения в Azure

MTKit Design собирается в статические страницы в `apps/web/dist`. Главная доступна по `/`, а каталог по `/catalog/`. Список остальных маршрутов задаёт конфигурация Vite.

1. Создайте пайплайн Azure DevOps из [deploy/azure-static-web-app.yml](../deploy/azure-static-web-app.yml). Шаблон запускается вручную.
2. Дайте учётной записи Build Service проекта право Feed Reader на Azure Artifacts `mt-packages`. Задача `npmAuthenticate@0` авторизует установку `@mtkit/ui` для сборки. [Доступ к feed из пайплайна](https://learn.microsoft.com/en-us/azure/devops/artifacts/feeds/feed-permissions#pipelines-permissions)
3. Добавьте секретную переменную `staticWebAppDeploymentToken` от выбранного Static Web App. При запуске укажите в параметре `mtkitMcpUrl` HTTPS-адрес командного MCP с путём `/mcp`. При пустом параметре сайт покажет инструкции для плагина и локального MCP. [Задача Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/azure-static-web-app-v0)
4. Запустите пайплайн и проверьте каждый маршрут, открытие карточки из прямой ссылки и копирование команды подключения. Когда командный MCP запущен, проверьте подключение из корпоративной сети. [Развёртывание MCP](deploy-mcp.md)

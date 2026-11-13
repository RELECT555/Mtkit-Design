# Развёртывание MTKit Catalog MCP

Веб-каталог можно разместить в Azure как статический сайт. Он использует тот же пакет `packages/catalog`, что и MCP. Для доступа к каталогу из Codex, Claude Code, Cursor и VS Code с Copilot разверните MCP на корпоративном Linux-сервере и подключите его через HTTPS. Сайт можно собрать и открыть независимо от доступности MCP.

## Корпоративный Linux-сервер

Понадобятся Docker, выделенное DNS-имя в корпоративной сети и HTTPS-вход через существующий reverse proxy. Клиент должен видеть это имя из сети компании или VPN. На машине сборки нужен доступ к публичному npm registry. Закрытый пакет `@mtkit/ui` для образа MCP не требуется.

Из корня репозитория соберите образ. Сборка запускает smoke-тест трёх режимов MCP.

```bash
docker build -t mtkit-catalog:<release> .
```

В защищённом файле окружения на сервере укажите выделенный адрес HTTPS и секрет. Для токена подойдёт случайное 32-байтное значение в hex. Выдайте его команде через корпоративное хранилище секретов.

```dotenv
MTKIT_PUBLIC_URL=https://<корпоративный-хост>/mcp
MTKIT_MCP_TOKEN=<секрет>
PORT=8080
```

Если reverse proxy работает на том же сервере, опубликуйте контейнерный порт только на loopback.

```bash
docker run -d --name mtkit-catalog --restart unless-stopped \
  --env-file /etc/mtkit-catalog/mcp.env \
  -p 127.0.0.1:8080:8080 mtkit-catalog:<release>
```

В существующем HTTPS-блоке nginx выделенного хоста добавьте маршрут. Прокси должен передавать `Authorization`, сохранять имя MCP в `Host` и пропускать потоковые ответы.

```nginx
location = /mcp {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_buffering off;
    proxy_read_timeout 90s;
}
```

Проверьте `curl -f http://127.0.0.1:8080/healthz` на сервере. Затем в рабочем терминале с `MTKIT_MCP_TOKEN` подключите HTTPS-адрес и откройте новый чат Codex.

```bash
codex mcp add mtkit_catalog_remote --url "https://<корпоративный-хост>/mcp" --bearer-token-env-var MTKIT_MCP_TOKEN
```

Чтобы показать варианты командного подключения на сайте, задайте `VITE_MTKIT_MCP_URL` при сборке фронта. В эту переменную входит только адрес. В разделе подключения выберите агента и «Командный MCP». Для Claude Code, Cursor и Copilot сайт сформирует проектный JSON с заголовком `Authorization` и ссылкой на `MTKIT_MCP_TOKEN`. Задайте переменную в окружении, из которого запускаете клиент, и объедините `mcpServers` с существующим конфигом.

Попросите агента вызвать `list_categories`, найти Playwright и открыть его карточку. Полный состав каталога доступен как ресурс `mtkit://catalog/inventory`.

Для Claude в браузере нужен endpoint, доступный из сети Anthropic. Инструкции выше относятся к Claude Code, который работает в окружении разработчика. [Требования к Claude Connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)

## Azure Container Apps

Если MCP нужен в Azure, тот же образ можно загрузить в корпоративный registry и запустить в существующем Container Apps environment. Укажите порт ingress `8080`, оставьте HTTPS обязательным и настройте доступ согласно правилам сети. Задайте `MTKIT_PUBLIC_URL` как реальный HTTPS-адрес с путём `/mcp`, а `MTKIT_MCP_TOKEN` как ссылку на секрет Container App или Key Vault. Для startup и readiness используйте `GET /healthz`. Если registry закрытый, используйте управляемую identity с разрешением на загрузку образа. [Ingress](https://learn.microsoft.com/en-us/azure/container-apps/ingress-how-to) · [Secrets](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets) · [Pull с управляемой identity](https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull)

## Локальная проверка

```bash
npm ci
npm run catalog:check
npm run catalog:build
npm run catalog:smoke
```

Обычный запуск плагина в Codex использует stdio. `npm run catalog:serve` поднимает локальный HTTP на `127.0.0.1:4387`. Контейнер запускает режим `--hosted`, в котором `/mcp` требует bearer-токен и проверяет Host и Origin. Терминация TLS выполняется HTTPS-прокси.

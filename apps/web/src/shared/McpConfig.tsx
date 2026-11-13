import type { ProjectConfiguration } from "@mtkit-design/catalog";
import { Command } from "./Command";

export function McpConfig({ configuration }: { configuration: ProjectConfiguration }) {
  return (
    <div>
      <p>Добавьте запись в <code>{configuration.path}</code> в корне проекта. Если файл уже есть, добавьте сервер в существующий <code>mcpServers</code>.</p>
      <Command value={JSON.stringify(configuration.content, null, 2)} />
    </div>
  );
}

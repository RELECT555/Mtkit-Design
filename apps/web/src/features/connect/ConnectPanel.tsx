import { Button } from "@mtkit/ui";
import { catalogConnection, clientLabels, planInstall, startLocalCatalog, type InstallClient } from "@mtkit-design/catalog";
import { useState } from "react";
import { ClientPicker } from "../../shared/ClientPicker";
import { Command } from "../../shared/Command";
import { McpConfig } from "../../shared/McpConfig";
import { codexCommand, hostedEndpoint } from "../../shared/connection";
import { connectIntro } from "../home/content";

const modes = [
  { id: "plugin", label: "Плагин Codex" },
  { id: "local", label: "Локальный MCP" },
  { id: "hosted", label: "Командный MCP" },
] as const;
type Mode = typeof modes[number]["id"];

const pluginPlan = planInstall("mtkit-catalog");
const localCommands = startLocalCatalog.map(({ command, args }) => [command, ...args].join(" ")).join("\n");
const pluginCommands = pluginPlan?.steps.map(({ command, args }) => [command, ...args].join(" ")).join("\n");

export function ConnectPanel() {
  const [client, setClient] = useState<InstallClient>("codex");
  const [mode, setMode] = useState<Mode>("plugin");
  const options = modes.filter(({ id }) => (id !== "plugin" || client === "codex") && (id !== "hosted" || hostedEndpoint));

  function changeClient(next: InstallClient) {
    setClient(next);
    if (mode === "plugin" && next !== "codex") setMode("local");
  }

  return (
    <section className="page-container home-container connect" id="connect" aria-labelledby="connect-title">
      <div>
        <h2 id="connect-title">{connectIntro.title}</h2>
        <p className="connect-description">{connectIntro.description}</p>
      </div>
      <div className="connect-panel">
        <ClientPicker client={client} onChange={changeClient} />
        {options.length > 1 && (
          <div className="switcher" role="group" aria-label="Способ подключения">
            {options.map(({ id, label }) => (
              <Button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</Button>
            ))}
          </div>
        )}
        <div className="connect-instructions" key={`${client}-${mode}`}>
          {mode === "plugin" && pluginCommands && (
            <div>
              <p>Выполните команды в корне репозитория MTKit Design.</p>
              <Command value={pluginCommands} />
            </div>
          )}
          {mode !== "plugin" && (
            <>
              {mode === "local" ? (
                <div>
                  <p>В корне репозитория MTKit Design соберите и запустите сервер. Оставьте его работать в терминале.</p>
                  <Command value={localCommands} />
                </div>
              ) : (
                <p>Подключитесь к корпоративной сети. Задайте <code>MTKIT_MCP_TOKEN</code> в окружении, из которого запускаете {clientLabels[client]}.</p>
              )}
              {client === "codex" ? (
                <div>
                  <p>Зарегистрируйте сервер в Codex.</p>
                  <Command value={codexCommand(mode)} />
                </div>
              ) : <McpConfig configuration={catalogConnection(client, mode === "hosted" ? hostedEndpoint : undefined)} />}
            </>
          )}
          <p>Откройте новый чат {clientLabels[client]} и попробуйте <a className="inline-link" href="/guide/">готовые промпты для MTKit Design</a>.</p>
        </div>
      </div>
    </section>
  );
}

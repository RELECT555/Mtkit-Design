import { Button } from "@mtkit/ui";
import { planInstall, type CatalogEntry, type InstallClient, type InstallStep } from "@mtkit-design/catalog";
import { useLayoutEffect, useRef, useState } from "react";
import { ClientPicker } from "../../shared/ClientPicker";
import { Command } from "../../shared/Command";
import { McpConfig } from "../../shared/McpConfig";
import { availabilityLabel, kindLabel } from "./labels";
import "./entry-dialog.css";

function InstallSteps({ steps }: { steps: readonly InstallStep[] }) {
  const groups: { cwd?: string; commands: string[] }[] = [];
  for (const { command, args, cwd } of steps) {
    const line = [command, ...args.map((arg) => /\s/.test(arg) ? JSON.stringify(arg) : arg)].join(" ");
    const previous = groups.at(-1);
    if (previous && previous.cwd === cwd) previous.commands.push(line);
    else groups.push({ cwd, commands: [line] });
  }
  return (
    <div className="entry-commands">
      {groups.map(({ cwd, commands }) => {
        const value = commands.join("\n");
        return (
          <div key={value}>
            {cwd && <p>{cwd}</p>}
            <Command value={value} />
          </div>
        );
      })}
    </div>
  );
}

export function EntryDialog({ entry, animate, close }: { entry: CatalogEntry; animate: boolean; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [client, setClient] = useState<InstallClient>("codex");
  const plan = planInstall(entry.id, client);
  const prerequisites = plan?.prerequisites ?? entry.prerequisites;

  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    title.current?.focus({ preventScroll: true });
    return () => element?.close();
  }, []);

  async function requestClose(animateExit: boolean) {
    const element = dialog.current;
    if (!element?.open) return;
    if (!animateExit || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      element.close();
      return;
    }
    if (element.hasAttribute("data-exiting")) return;

    element.setAttribute("data-exiting", "");
    const animations = element.getAnimations?.() ?? [];
    if (animations.length > 0) await Promise.allSettled(animations.map((animation) => animation.finished));
    if (element.isConnected && element.open) element.close();
  }

  return (
    <dialog className="entry-dialog" data-animate={animate ? "" : undefined} ref={dialog} onClose={close} aria-labelledby="entry-title" aria-describedby="entry-description">
      <div className="entry-detail">
        <header className="detail-top">
          <div className="entry-heading">
            <p className="entry-kicker">{kindLabel[entry.kind]} <span aria-hidden="true">·</span> {availabilityLabel[entry.availability]}</p>
            <h2 id="entry-title" ref={title} tabIndex={-1}>{entry.title}</h2>
          </div>
          <Button className="entry-close" type="button" variant="ghost" aria-label="Закрыть карточку" onClick={(event) => void requestClose(event.detail > 0)}>
            <span aria-hidden="true" />
          </Button>
        </header>
        <p id="entry-description">{entry.description}</p>
        {plan && (
          <section className="entry-install">
            <h3>Установка</h3>
            <ClientPicker client={client} onChange={setClient} />
            <div className="entry-instructions" key={client}>
              {plan.client === "codex" && plan.bundledSteps && <p>Плагин Codex уже подключает этот сервер. Команды ниже подходят для отдельной установки.</p>}
              {plan.steps.length > 0 && <InstallSteps steps={plan.steps} />}
              {"copySkill" in plan && <p>Скопируйте папку <code>{plan.copySkill.from}</code> из MTKit Design в <code>{plan.copySkill.to}</code> в рабочем проекте. Перенесите всю папку вместе с файлами навыка.</p>}
              {"configuration" in plan && <McpConfig configuration={plan.configuration} />}
              <p>{plan.verification}</p>
            </div>
          </section>
        )}
        <div className="entry-extra">
          <details>
            <summary>Требования, доступ и сведения</summary>
            <div className="entry-extra-body">
              {prerequisites.length > 0 && (
                <div>
                  <h3>Что понадобится</h3>
                  <ul>{prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              )}
              <dl className="entry-meta">
                <div><dt>Доступ</dt><dd>{entry.access}</dd></div>
                <div><dt>Категория</dt><dd>{entry.category}</dd></div>
                <div><dt>ID в MCP</dt><dd><code>{entry.id}</code></dd></div>
                {entry.sourcePath && <div><dt>Файл</dt><dd><code>{entry.sourcePath}</code></dd></div>}
                {entry.revision && <div><dt>Версия</dt><dd><code>{entry.revision}</code></dd></div>}
              </dl>
            </div>
          </details>
          {entry.sourceUrl && <a className="inline-link" href={entry.sourceUrl} target="_blank" rel="noreferrer">Оригинальный источник <span aria-hidden="true">↗</span></a>}
        </div>
      </div>
    </dialog>
  );
}

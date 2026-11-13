import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@mtkit/ui";
import { planInstall, queryCatalog } from "@mtkit-design/catalog";
import { useEffect, useRef, useState } from "react";
import { Command } from "../../shared/Command";
import type { createShaderRenderer as createRenderer } from "../shaders/webgl";

const matches = queryCatalog({ query: "доступность браузер", limit: 2 }).entries;
const entry = matches.find(({ kind }) => kind === "mcp") ?? matches[0];
const plan = entry && planInstall(entry.id);
const backdropSettings = { colors: ["#f4aa8e", "#9b85ff"], speed: 0.65, intensity: 1.1 } as const;

function WorkflowBackdrop() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createRenderer>>(null);
  const playingRef = useRef(true);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    playingRef.current = playing;
    renderer.current?.configure({ ...backdropSettings, playing });
  }, [playing]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let nearViewport = false;
    let revision = 0;

    async function update() {
      const request = ++revision;
      renderer.current?.dispose();
      renderer.current = null;
      setReady(false);
      if (!nearViewport || motion.matches) return;

      try {
        const [{ createShaderRenderer }, { auroraFragment }] = await Promise.all([
          import("../shaders/webgl"),
          import("../shaders/aurora"),
        ]);
        if (request !== revision || !element) return;
        renderer.current = createShaderRenderer(element, auroraFragment, {
          ...backdropSettings, playing: playingRef.current,
        }, setReady, { renderScale: 0.65 });
        setReady(Boolean(renderer.current));
      } catch {
        if (request === revision) setReady(false);
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      nearViewport = true;
      observer.disconnect();
      void update();
    }, { rootMargin: "120px 0px" });
    observer.observe(element);
    motion.addEventListener("change", update);
    return () => {
      revision++;
      observer.disconnect();
      renderer.current?.dispose();
      renderer.current = null;
      motion.removeEventListener("change", update);
    };
  }, []);

  return (
    <>
      <canvas className="workflow-canvas" aria-hidden="true" data-ready={ready} ref={canvas} />
      {ready && (
        <Button className="workflow-motion" type="button" variant="ghost" aria-label={playing ? "Пауза анимации фона" : "Воспроизвести анимацию фона"} onClick={() => setPlaying(!playing)}>
          {playing ? "Пауза" : "Воспроизвести"}
        </Button>
      )}
    </>
  );
}

export function McpWorkflow() {
  return (
    <section className="workflow" id="workflow" aria-labelledby="workflow-title">
      <WorkflowBackdrop />
      <div className="workflow-grid">
        <div className="workflow-intro">
          <h2 id="workflow-title">Как работает MCP</h2>
          <p className="workflow-prompt">«Найди инструменты для проверки доступности React-экрана»</p>
        </div>
        <Tabs className="workflow-example" defaultValue="search">
          <TabsList className="workflow-controls" aria-label="Шаги примера">
            <TabsTrigger value="search">Поиск</TabsTrigger>
            <TabsTrigger value="entry">Карточка</TabsTrigger>
            <TabsTrigger value="install">Установка</TabsTrigger>
          </TabsList>
          <TabsContent className="workflow-output" value="search">
            <code>search_entries</code>
            <ul>{matches.map((match) => (
              <li key={match.id}>
                <a href={`/catalog/?entry=${encodeURIComponent(match.id)}`}>{match.title}</a>
                <span>{match.category}</span>
              </li>
            ))}</ul>
          </TabsContent>
          <TabsContent className="workflow-output" value="entry">
            <code>get_entry</code>
            {entry && <><p className="workflow-entry">{entry.title}</p><p>{entry.access}</p></>}
          </TabsContent>
          <TabsContent className="workflow-output" value="install">
            <code>plan_install</code>
            {plan && <Command value={plan.steps.map(({ command, args }) => [command, ...args].join(" ")).join("\n")} />}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

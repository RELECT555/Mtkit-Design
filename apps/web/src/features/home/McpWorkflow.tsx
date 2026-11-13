import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@mtkit/ui";
import { planInstall, recommendForTask } from "@mtkit-design/catalog";
import { useEffect, useRef, useState } from "react";
import { Command } from "../../shared/Command";
import { workflowExample } from "./content";
import type { createShaderRenderer as createRenderer } from "../shaders/webgl";

const recommendations = recommendForTask(workflowExample.task);
const entry = recommendations.find(({ entry }) => entry.id === "playwright")?.entry;
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
          <h2 id="workflow-title">{workflowExample.title}</h2>
          <p className="workflow-prompt">«{workflowExample.task}»</p>
        </div>
        <Tabs className="workflow-example" defaultValue="recommend">
          <TabsList className="workflow-controls" aria-label="Шаги примера">
            {workflowExample.steps.map(({ id, label }) => <TabsTrigger key={id} value={id}>{label}</TabsTrigger>)}
          </TabsList>
          <TabsContent className="workflow-output" value="recommend">
            <code>{workflowExample.steps[0].tool}</code>
            <ul>{recommendations.map(({ entry }) => (
              <li key={entry.id}>
                <a href={`/catalog/?entry=${encodeURIComponent(entry.id)}`}>{entry.title}</a>
                <span>{entry.kind === "skill" ? "Навык" : "MCP"}</span>
              </li>
            ))}</ul>
          </TabsContent>
          <TabsContent className="workflow-output" value="entry">
            <code>{workflowExample.steps[1].tool}</code>
            {entry && <><p className="workflow-entry">{entry.title}</p><p>{entry.access}</p></>}
          </TabsContent>
          <TabsContent className="workflow-output" value="install">
            <code>{workflowExample.steps[2].tool}</code>
            {plan && <Command value={plan.steps.map(({ command, args }) => [command, ...args].join(" ")).join("\n")} />}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

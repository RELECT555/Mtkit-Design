import { Button } from "@mtkit/ui";
import { useEffect, useRef, useState } from "react";
import { Layout } from "../app/Layout";
import badgeUrl from "../features/logo/mtkit-badge-3d.glb?url";
import logoUrl from "../features/logo/mtkit-design-3d.glb?url";
import logoPoster from "../features/logo/mtkit-logo-render.png";
import badgePoster from "../features/logo/mtkit-badge-render.png";
import type { createLogoScene } from "../features/logo/logoScene";
import { logoIcons, logoIntro, logoVariants } from "../features/logo/content";

const models = {
  logo: { ...logoVariants.logo, url: logoUrl, poster: logoPoster },
  badge: { ...logoVariants.badge, url: badgeUrl, poster: badgePoster },
};
type Model = keyof typeof models;

function LogoIcon({ name }: { name: keyof typeof logoIcons }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={logoIcons[name]} /></svg>;
}

export function LogoPage() {
  const [selected, setSelected] = useState<Model>("logo");
  const [requested, setRequested] = useState(false);
  const [loaded, setLoaded] = useState<Model>();
  const [failed, setFailed] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ReturnType<typeof createLogoScene>>(undefined);
  const current = models[selected];
  const ready = requested && loaded === selected && !contextLost;
  const hint = contextLost ? "3D-просмотр прерван. Рендер и скачивание доступны."
    : failed ? "3D-модель не загрузилась. Попробуйте открыть её снова."
    : ready ? "Поворачивайте модель перетаскиванием или стрелками."
    : requested ? "Загружается 3D-модель…" : "";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!requested || !canvas) return;

    const request = new AbortController();
    void (async () => {
      try {
        const { createLogoScene } = await import("../features/logo/logoScene");
        if (request.signal.aborted) return;
        const scene = sceneRef.current ??= createLogoScene(canvas);
        await scene.show(current.url, request.signal);
        if (!request.signal.aborted) setLoaded(selected);
      } catch {
        if (!request.signal.aborted) {
          setFailed(true);
          setRequested(false);
        }
      }
    })();
    return () => request.abort();
  }, [current.url, requested, selected]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!requested || !canvas) return;
    const onLost = () => setContextLost(true);
    const onRestored = () => setContextLost(false);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      sceneRef.current?.dispose();
      sceneRef.current = undefined;
    };
  }, [requested]);

  function toggleViewer() {
    setFailed(false);
    setContextLost(false);
    setLoaded(undefined);
    setRequested((active) => !active);
  }

  return (
    <Layout page="logo">
      <section className="page-container logo-page" aria-labelledby="logo-title">
        <header className="logo-intro">
          <h1 id="logo-title">{logoIntro.title} <span>{logoIntro.brand}</span></h1>
          <p>{logoIntro.description}</p>
        </header>
        <div className="logo-viewer">
          <div className="logo-toolbar">
            <div className="logo-variants" role="group" aria-label="Вариант логотипа">
              {(Object.keys(models) as Model[]).map((id) => (
                <Button key={id} type="button" variant="ghost" aria-pressed={selected === id} onClick={() => {
                  if (selected === id) return;
                  setFailed(false);
                  setLoaded(undefined);
                  setSelected(id);
                }}>{models[id].label}</Button>
              ))}
            </div>
            <Button type="button" className="logo-toggle" aria-pressed={requested} aria-controls="logo-stage" onClick={toggleViewer}>
              <LogoIcon name="model" /> 3D-просмотр
            </Button>
          </div>
          <div id="logo-stage" className="logo-stage" data-ready={ready || undefined} data-model={selected} aria-busy={requested && loaded !== selected && !contextLost}>
            <img className="logo-poster" src={current.poster} alt={ready ? "" : current.label + " MTKit Design"} />
            {requested && <canvas
              ref={canvasRef}
              tabIndex={ready ? 0 : -1}
              aria-hidden={!ready}
              aria-label={"3D-модель «" + current.label + "». Поворот стрелками"}
              onKeyDown={(event) => {
                const step = Math.PI / 15;
                const directions: Record<string, [number, number]> = {
                  ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
                };
                const direction = directions[event.key];
                if (!direction || !ready) return;
                event.preventDefault();
                sceneRef.current?.rotate(...direction);
              }}
            />}
          </div>
          <div className="logo-footer">
            {requested ? (
              <div className="logo-view-controls" role="group" aria-label="Масштаб и ракурс">
                <Button type="button" variant="outline" aria-label="Уменьшить" title="Уменьшить" disabled={!ready} onClick={() => sceneRef.current?.zoom(1 / 1.2)}><LogoIcon name="minus" /></Button>
                <Button type="button" variant="outline" aria-label="Увеличить" title="Увеличить" disabled={!ready} onClick={() => sceneRef.current?.zoom(1.2)}><LogoIcon name="plus" /></Button>
                <Button type="button" variant="outline" aria-label="Сбросить вид" title="Сбросить вид" disabled={!ready} onClick={() => sceneRef.current?.reset()}><LogoIcon name="reset" /></Button>
              </div>
            ) : <code className="logo-filename">{current.filename}</code>}
            <p className="logo-hint" role="status">{hint}</p>
            <Button asChild variant="outline" className="logo-download">
              <a href={current.url} download={current.filename}><LogoIcon name="download" /> Скачать GLB</a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

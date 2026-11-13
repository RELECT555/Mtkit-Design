import { Button } from "@mtkit/ui";
import { useEffect, useRef, useState } from "react";
import { Layout } from "../app/Layout";
import badgeUrl from "../features/logo/mtkit-badge-3d.glb?url";
import logoUrl from "../features/logo/mtkit-design-3d.glb?url";
import logoPoster from "../features/logo/mtkit-logo-render.png";
import badgePoster from "../features/logo/mtkit-badge-render.png";
import type { createLogoScene } from "../features/logo/logoScene";

const models = {
  logo: { label: "Полный логотип", url: logoUrl, poster: logoPoster, filename: "mtkit-design-3d.glb" },
  badge: { label: "Знак", url: badgeUrl, poster: badgePoster, filename: "mtkit-badge-3d.glb" },
};
type Model = keyof typeof models;

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
        <div className="logo-intro">
          <div>
            <h1 id="logo-title">Логотип <span>MTKit Design</span></h1>
            <p>Рассмотрите объёмную модель и скачайте её в формате GLB.</p>
          </div>
          <a className="logo-download" href={current.url} download={current.filename}>Скачать GLB <span aria-hidden="true">↓</span></a>
        </div>
        <div className="logo-viewer">
          <div className="logo-toolbar">
            <div className="switcher" role="group" aria-label="Вариант логотипа">
              {(Object.keys(models) as Model[]).map((id) => (
                <Button key={id} type="button" aria-pressed={selected === id} onClick={() => {
                  if (selected === id) return;
                  setFailed(false);
                  setLoaded(undefined);
                  setSelected(id);
                }}>{models[id].label}</Button>
              ))}
            </div>
            <div className="switcher logo-view-controls" role="group" aria-label="Управление 3D-моделью">
              <Button type="button" aria-pressed={requested} onClick={toggleViewer}>3D-просмотр</Button>
              <Button type="button" aria-label="Уменьшить" disabled={!ready} onClick={() => sceneRef.current?.zoom(1 / 1.2)}>−</Button>
              <Button type="button" aria-label="Увеличить" disabled={!ready} onClick={() => sceneRef.current?.zoom(1.2)}>+</Button>
              <Button type="button" disabled={!ready} onClick={() => sceneRef.current?.reset()}>Сбросить вид</Button>
            </div>
          </div>
          <div className="logo-stage" data-ready={ready || undefined} data-model={selected}>
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
          <p className="logo-hint" role="status">
            {failed || contextLost
              ? "Интерактивная модель недоступна. Можно посмотреть рендер и скачать GLB."
              : ready ? "Перетащите модель или используйте стрелки, чтобы повернуть её." : requested ? "Загружается 3D-модель…" : ""}
          </p>
        </div>
      </section>
    </Layout>
  );
}

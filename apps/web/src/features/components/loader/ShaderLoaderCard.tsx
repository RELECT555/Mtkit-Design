import { Button, Card, Input } from "@mtkit/ui";
import { useEffect, useRef, useState } from "react";
import { Loader, type LoaderShape, type LoaderStyle } from "./Loader";
import "./loader-demo.css";

const shapes = { sphere: "Сфера", swirl: "Вихрь", ripple: "Рябь" } as const;
const variants = { plain: "Чёткий", blur: "Мягкий", dither: "Пиксельный" } as const;
const sizes = { sm: "48", default: "80", lg: "120" } as const;

export function ShaderLoaderCard() {
  const [shape, setShape] = useState<LoaderShape>("sphere");
  const [variant, setVariant] = useState<LoaderStyle>("dither");
  const [size, setSize] = useState<keyof typeof sizes>("default");
  const [color, setColor] = useState("#00b3ff");
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function exportSource(download: boolean) {
    setBusy(true);
    setStatus("");
    try {
      const { loaderSource } = await import("./source");
      const source = loaderSource({ shape, variant, size, color, speed, paused });
      if (!active.current) return;
      if (download) {
        const url = URL.createObjectURL(new Blob([source], { type: "text/plain;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "Loader.tsx";
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus("Loader.tsx скачан");
      } else {
        await navigator.clipboard.writeText(source);
        if (active.current) setStatus("Код скопирован");
      }
    } catch {
      if (active.current) setStatus(download ? "Не удалось скачать файл. Попробуйте ещё раз." : "Не удалось скопировать. Скачайте TSX-файл.");
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return (
    <Card className="component-preview loader-demo" id="shader-loader">
      <div className="component-preview-stage loader-demo-stage">
        <Loader shape={shape} variant={variant} size={size} color={color} speed={speed} paused={paused} role="img" aria-label={`Превью: ${shapes[shape]}, ${variants[variant]}`} />
        <Button type="button" variant="outline" className="loader-playback" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "Пуск" : "Пауза"}</Button>
      </div>
      <div className="component-preview-caption">
        <h2>Shader Loader</h2>
        <p>Индикатор загрузки: три формы и три способа отрисовки.</p>
        <div className="loader-demo-controls">
          <fieldset><legend>Форма</legend><div className="loader-choice-row">
            {(Object.keys(shapes) as LoaderShape[]).map(value => <label key={value}><input type="radio" name="loader-shape" value={value} checked={shape === value} onChange={() => setShape(value)} /><span>{shapes[value]}</span></label>)}
          </div></fieldset>
          <fieldset><legend>Стиль</legend><div className="loader-choice-row">
            {(Object.keys(variants) as LoaderStyle[]).map(value => <label key={value}><input type="radio" name="loader-variant" value={value} checked={variant === value} onChange={() => setVariant(value)} /><span>{variants[value]}</span></label>)}
          </div></fieldset>
          <fieldset><legend>Размер, px</legend><div className="loader-choice-row">
            {(Object.keys(sizes) as (keyof typeof sizes)[]).map(value => <label key={value}><input type="radio" name="loader-size" value={value} checked={size === value} onChange={() => setSize(value)} /><span>{sizes[value]}</span></label>)}
          </div></fieldset>
          <label className="loader-speed"><span>Скорость <output>{speed.toFixed(2)}×</output></span><input type="range" aria-label="Скорость лоадера" min="0.25" max="2" step="0.05" value={speed} onChange={event => setSpeed(event.target.valueAsNumber)} /></label>
          <label className="loader-color"><span>Цвет</span><Input type="color" value={color} onChange={event => setColor(event.target.value)} /><code>{color}</code></label>
        </div>
        <div className="loader-export">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void exportSource(false)}>Копировать TSX</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void exportSource(true)}>Скачать .tsx</Button>
        </div>
        <p className="loader-export-hint">Один React-файл и пример с текущими настройками.</p>
        <p className="loader-feedback" role="status">{status}</p>
        <a className="inline-link" href="https://ds.asanshay.com/loader" target="_blank" rel="noreferrer">Оригинал от asanshay <span aria-hidden="true">↗</span></a>
      </div>
    </Card>
  );
}

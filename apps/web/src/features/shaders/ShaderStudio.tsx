import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@mtkit/ui";
import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent, type Ref } from "react";
import { ShaderCanvas } from "./ShaderCanvas";
import type { ShaderPreset } from "./presets";
import { shaderPrompt } from "./shaderPrompt";
import { imageDemo } from "./imageDemo";

type SourceState = { status: "idle" | "loading" | "error" } | {
  status: "ready";
  generate: typeof import("./componentSource").componentSource;
  demoImage: string;
};

export function ShaderStudio({ preset, playing, onPlayingChange, onBack, headingRef }: {
  preset: ShaderPreset;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  onBack: (event: MouseEvent<HTMLAnchorElement>) => void;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const [tab, setTab] = useState("preview");
  const [speed, setSpeed] = useState(1);
  const [intensity, setIntensity] = useState(1);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [imageSrc, setImageSrc] = useState("");
  const [imageName, setImageName] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const imageReader = useRef<FileReader | null>(null);
  const [sourceState, setSourceState] = useState<SourceState>({ status: "idle" });
  const preview = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);
  const palette = preset.palettes[paletteIndex];
  const changed = paletteIndex !== 0 || intensity !== 1 || speed !== 1 || imageSrc !== "";
  const source = tab === "code" && sourceState.status === "ready"
    ? sourceState.generate(preset, palette, speed, intensity, imageSrc || sourceState.demoImage)
    : "";
  const prompt = tab === "prompt" ? shaderPrompt(preset, palette, speed, intensity) : "";

  useEffect(() => {
    const syncFullscreen = () => setExpanded(document.fullscreenElement === preview.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      window.clearTimeout(timer.current);
      imageReader.current?.abort();
    };
  }, []);

  async function loadSource() {
    if (sourceState.status === "loading" || sourceState.status === "ready") return;
    setSourceState({ status: "loading" });
    try {
      const [{ componentSource }, demo] = await Promise.all([
        import("./componentSource"),
        preset.renderer?.image ? import("./image-demo.jpg?inline") : Promise.resolve({ default: "" }),
      ]);
      setSourceState({ status: "ready", generate: componentSource, demoImage: demo.default });
    } catch {
      setSourceState({ status: "error" });
    }
  }

  function changeTab(value: string) {
    setTab(value);
    if (value === "code") void loadSource();
  }

  function reset() {
    setPaletteIndex(0);
    setIntensity(1);
    setSpeed(1);
    resetImage();
  }

  function resetImage() {
    imageReader.current?.abort();
    setImageSrc("");
    setImageName("");
    setShowOriginal(false);
    if (imageInput.current) imageInput.current.value = "";
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    imageReader.current?.abort();
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      notify("Выберите PNG, JPEG или WebP размером до 8 МБ");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    imageReader.current = reader;
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setImageSrc(reader.result);
      setImageName(file.name);
      setShowOriginal(false);
    };
    reader.onerror = () => notify("Не удалось прочитать файл. Попробуйте другое изображение.");
    reader.readAsDataURL(file);
  }

  function notify(message: string) {
    window.clearTimeout(timer.current);
    setStatus(message);
    timer.current = window.setTimeout(() => setStatus(""), 3500);
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify(`${label} скопирован`);
    } catch {
      notify("Выделите текст и скопируйте вручную");
    }
  }

  function downloadSource() {
    if (!source) return;
    const url = URL.createObjectURL(new Blob([source], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${preset.componentName}.tsx`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function toggleFullscreen() {
    try {
      if (expanded) await document.exitFullscreen();
      else await preview.current?.requestFullscreen();
    } catch {
      notify("Полноэкранный режим недоступен");
    }
  }

  return (
    <article className="shader-studio" aria-labelledby="shader-title">
      <header className="shader-heading">
        <nav className="shader-crumb" aria-label="Навигация по шейдерам">
          <a href="/shaders/" onClick={onBack}><span aria-hidden="true">←</span> Все шейдеры</a>
          <span aria-hidden="true">/</span> {preset.group}
        </nav>
        <h1 id="shader-title" tabIndex={-1} ref={headingRef}>{preset.name}</h1>
        <p className="shader-description">{preset.description}</p>
      </header>
      <Tabs value={tab} onValueChange={changeTab} className="shader-workbench">
        <div className="shader-toolbar">
          <TabsList className="shader-tabs" aria-label="Режим просмотра">
            <TabsTrigger value="preview">Превью</TabsTrigger>
            <TabsTrigger value="code">Код</TabsTrigger>
            <TabsTrigger value="prompt">Промпт</TabsTrigger>
          </TabsList>
          <code className="shader-filename">{preset.componentName}.tsx</code>
        </div>
        <TabsContent value="preview" className="shader-tab-content" forceMount>
          <div className="shader-preview" ref={preview}>
            <ShaderCanvas fragment={preset.fragment} colors={palette.colors} speed={speed} intensity={intensity} playing={playing && tab === "preview" && !showOriginal} options={preset.renderer} imageSrc={preset.renderer?.image ? imageSrc || imageDemo.url : undefined} />
            {showOriginal && preset.renderer?.image && <div className="shader-original" data-fit={preset.renderer?.particles ? "contain" : "cover"}><img src={imageSrc || imageDemo.url} alt="Исходное изображение без эффекта" /></div>}
            {showContent && <div className="shader-content-demo" aria-hidden="true">
              <p>Пример первого экрана</p>
              <strong>Новый горизонт</strong>
              <span>Анимированный фон под вашим контентом.</span>
            </div>}
            <div className="shader-preview-tools" aria-label="Управление превью">
              {preset.renderer?.image && <Button type="button" variant="outline" aria-pressed={showOriginal} onClick={() => setShowOriginal(!showOriginal)}>Оригинал</Button>}
              <Button type="button" variant="outline" aria-pressed={showContent} onClick={() => setShowContent(!showContent)}>
                С контентом
              </Button>
              <Button type="button" variant="outline" disabled={showOriginal} onClick={() => onPlayingChange(!playing)}>
                <span aria-hidden="true">{playing ? "Ⅱ" : "▸"}</span>
                {playing ? "Пауза" : "Пуск"}
              </Button>
              {document.fullscreenEnabled && <Button type="button" variant="outline" aria-label={expanded ? "Выйти из полноэкранного режима" : "На весь экран"} onClick={toggleFullscreen}>
                <span aria-hidden="true">{expanded ? "×" : "⛶"}</span>
              </Button>}
            </div>
          </div>
          {preset.interaction && <p className="shader-interaction">{preset.interaction}</p>}
          {preset.renderer?.image && <div className="shader-image-control">
            <label htmlFor="shader-image">Изображение
              <input ref={imageInput} id="shader-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} aria-describedby="shader-image-hint" />
            </label>
            <p id="shader-image-hint">{imageName || <>Демо · Фото <a href={imageDemo.source} target="_blank" rel="noreferrer">{imageDemo.author}</a></>} · PNG, JPEG, WebP до 8 МБ. Файл остаётся в браузере.</p>
            {imageSrc && <Button type="button" variant="ghost" className="shader-image-reset" onClick={resetImage}>Вернуть демо</Button>}
          </div>}
          <section className="shader-controls" aria-labelledby="shader-controls-title">
            <div className="shader-controls-heading">
              <h2 id="shader-controls-title">Настройки</h2>
              <Button type="button" variant="ghost" disabled={!changed} onClick={reset}>Сбросить</Button>
            </div>
            <div className="shader-settings">
              <label className="shader-slider">
                <span id="shader-speed-label">Скорость</span><output aria-hidden="true">{speed.toFixed(2)}×</output>
                <input type="range" aria-labelledby="shader-speed-label" aria-valuetext={`${speed.toFixed(2)}×`} min="0.25" max="2" step="0.05" value={speed} onChange={(event) => setSpeed(event.target.valueAsNumber)} />
              </label>
              <label className="shader-slider">
                <span id="shader-intensity-label">Интенсивность</span><output aria-hidden="true">{Math.round(intensity * 100)}%</output>
                <input type="range" aria-labelledby="shader-intensity-label" aria-valuetext={`${Math.round(intensity * 100)}%`} min="0.25" max="1.75" step="0.05" value={intensity} onChange={(event) => setIntensity(event.target.valueAsNumber)} />
              </label>
              <fieldset className="shader-palettes">
                <legend>Палитра</legend>
                <div className="shader-palette-options">
                  {preset.palettes.map(({ name, colors }, index) => (
                    <label className="shader-palette" key={name} title={name}>
                      <input type="radio" name="shader-palette" checked={paletteIndex === index} onChange={() => setPaletteIndex(index)} />
                      <span className="sr-only">{name}</span>
                      <span aria-hidden="true" style={{ background: `linear-gradient(132deg, ${colors[0]} 46%, ${colors[1]} 54%)` }} />
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="code" className="shader-tab-content">
          <div className="shader-code-toolbar">
            <p>React + TypeScript · Текущие настройки</p>
            {sourceState.status === "error" ? (
              <Button type="button" onClick={loadSource}>Повторить загрузку</Button>
            ) : (
              <div className="shader-code-actions">
                <Button type="button" variant="outline" disabled={!source} onClick={downloadSource}>Скачать .tsx</Button>
                <Button type="button" disabled={!source} onClick={() => copy(source, "Код")}>Копировать TSX</Button>
              </div>
            )}
          </div>
          {source ? (
            <>
              <pre className="shader-source" tabIndex={0} aria-label="Исходный код компонента"><code>{source}</code></pre>
              <p className="shader-code-tip">Сохраните файл <code>{preset.componentName}.tsx</code> и добавьте <code>{`<${preset.componentName} />`}</code> в свой React-проект.{preset.renderer?.image && " Для другой картинки передайте imageSrc. Выбранный здесь файл включается в код."}</p>
            </>
          ) : sourceState.status === "error" ? (
            <p className="shader-source" role="alert">Не удалось загрузить исходный код.</p>
          ) : (
            <p className="shader-source" role="status">Загружается исходный код…</p>
          )}
        </TabsContent>
        <TabsContent value="prompt" className="shader-tab-content">
          <div className="shader-code-toolbar">
            <p>Английский промпт для Codex и других агентов</p>
            <Button type="button" onClick={() => copy(prompt, "Промпт")}>Копировать промпт</Button>
          </div>
          <pre className="shader-source shader-prompt" tabIndex={0} lang="en" aria-label="Промпт для генерации компонента">{prompt}</pre>
        </TabsContent>
      </Tabs>
      <p className="shader-feedback" role="status">{status}</p>
    </article>
  );
}

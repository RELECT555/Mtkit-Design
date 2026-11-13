import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createShaderRenderer, type ShaderRendererOptions } from "./webgl";
import type { ImageTextureStatus } from "./imageTexture";
import { scheduleShaderInitialization } from "./initializationQueue";

type Props = {
  fragment: string;
  colors: readonly [string, string];
  speed: number;
  intensity: number;
  playing: boolean;
  thumbnail?: boolean;
  options?: ShaderRendererOptions;
  imageSrc?: string;
};

export function ShaderCanvas({ fragment, colors, speed, intensity, playing, thumbnail = false, options, imageSrc }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createShaderRenderer>>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [nearViewport, setNearViewport] = useState(false);
  const [imageStatus, setImageStatus] = useState<ImageTextureStatus>("ready");
  const canRender = !thumbnail || nearViewport;
  const [primary, secondary] = colors;
  const settings = useRef({ colors, speed, intensity, playing, imageSrc });

  useEffect(() => {
    settings.current = { colors: [primary, secondary], speed, intensity, playing, imageSrc };
    renderer.current?.configure(settings.current);
  }, [primary, secondary, speed, intensity, playing, imageSrc]);

  useEffect(() => {
    const element = canvas.current;
    if (canRender || !element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setNearViewport(true);
    }, { rootMargin: "80px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [canRender]);

  useEffect(() => {
    if (!canRender || !canvas.current) return;
    const element = canvas.current;
    setStatus("loading");
    let instance: ReturnType<typeof createShaderRenderer> = null;
    const cancel = scheduleShaderInitialization(() => {
      try {
        instance = createShaderRenderer(element, fragment, settings.current,
          (available) => setStatus(available ? "ready" : "fallback"), {
            ...options,
            pointer: !thumbnail && options?.pointer,
            previewPointer: thumbnail && options?.image,
            renderScale: (options?.renderScale ?? 1) * (thumbnail ? (options?.image ? 0.9 : 0.6) : 1),
          }, setImageStatus);
        renderer.current = instance;
        setStatus(instance ? "ready" : "fallback");
      } catch {
        setStatus("fallback");
      }
    });
    return () => {
      cancel();
      instance?.dispose();
      renderer.current = null;
    };
  }, [canRender, fragment, thumbnail, options]);

  const loading = status === "loading" || (status === "ready" && options?.image && imageStatus === "loading");

  return (
    <div
      className="shader-frame"
      data-renderer={status}
      aria-busy={loading || undefined}
      style={{ "--shader-primary": primary, "--shader-secondary": secondary } as CSSProperties}
    >
      <canvas ref={canvas} aria-hidden="true" />
      {loading && !thumbnail && <p className="shader-loading-label" role="status">{imageStatus === "loading" ? "Загружаем изображение…" : "Готовим превью…"}</p>}
      {status === "fallback" && !thumbnail && <p className="shader-fallback" role="status">WebGL недоступен. Показан статичный фон.</p>}
      {options?.image && imageStatus === "error" && !thumbnail && <p className="shader-fallback" role="status">Не удалось загрузить изображение. Выберите другой файл.</p>}
    </div>
  );
}

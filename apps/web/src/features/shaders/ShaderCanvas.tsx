import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createShaderRenderer, type ShaderRendererOptions } from "./webgl";
import type { ImageTextureStatus } from "./imageTexture";

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
    const instance = createShaderRenderer(canvas.current, fragment, {
      colors: ["#000000", "#000000"], speed: 1, intensity: 0, playing: false,
    }, (available) => setStatus(available ? "ready" : "fallback"), {
      ...options,
      pointer: !thumbnail && options?.pointer,
      previewPointer: thumbnail && options?.image,
      renderScale: (options?.renderScale ?? 1) * (thumbnail ? (options?.image ? 0.9 : 0.6) : 1),
    }, setImageStatus);
    renderer.current = instance;
    setStatus(instance ? "ready" : "fallback");
    return () => {
      instance?.dispose();
      renderer.current = null;
    };
  }, [canRender, fragment, thumbnail, options]);

  useEffect(() => {
    renderer.current?.configure({ colors: [primary, secondary], speed, intensity, playing, imageSrc });
  }, [canRender, fragment, thumbnail, options, primary, secondary, speed, intensity, playing, imageSrc]);

  return (
    <div
      className="shader-frame"
      data-renderer={status}
      style={{ "--shader-primary": primary, "--shader-secondary": secondary } as CSSProperties}
    >
      <canvas ref={canvas} aria-hidden="true" />
      {status === "fallback" && !thumbnail && <p className="shader-fallback" role="status">WebGL недоступен. Показан статичный фон.</p>}
      {options?.image && imageStatus !== "ready" && !thumbnail && <p className="shader-fallback" role="status">{imageStatus === "loading" ? "Загружаем изображение…" : "Не удалось загрузить изображение. Выберите другой файл."}</p>}
    </div>
  );
}

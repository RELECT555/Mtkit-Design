import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { ShaderCanvas } from "./ShaderCanvas";
import type { Palette, ShaderPreset } from "./presets";

const effects = {
  tubes: lazy(() => import("./tubes/TubesInteractiveBackground").then(({ TubesInteractiveBackground }) => ({ default: TubesInteractiveBackground }))),
  "liquid-ether": lazy(() => import("./liquid-ether/LiquidEtherBackground").then(({ LiquidEtherBackground }) => ({ default: LiquidEtherBackground }))),
};

type Props = {
  preset: ShaderPreset;
  palette: Palette;
  speed: number;
  intensity: number;
  playing: boolean;
  imageSrc?: string;
  thumbnail?: boolean;
};

const fill: CSSProperties = { position: "absolute", inset: 0, minHeight: 0 };

export function ShaderPreview({ preset, palette, speed, intensity, playing, imageSrc, thumbnail = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!thumbnail || !element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      // Each renderer pauses itself offscreen. Retain its frame and GPU resources
      // so scrolling back does not recreate the scene or reset the simulation.
      setNearViewport(true);
    }, { rootMargin: "80px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [thumbnail]);

  if (!preset.effect) {
    const [primary, secondary] = palette.colors;
    return <ShaderCanvas fragment={preset.fragment} colors={[primary, secondary]} speed={speed} intensity={intensity} playing={playing} options={preset.renderer} imageSrc={imageSrc} thumbnail={thumbnail} />;
  }

  const Effect = effects[preset.effect];
  return (
    <div ref={container} className="shader-effect" data-effect={preset.effect}>
      {(!thumbnail || nearViewport) && (
        <Suspense fallback={thumbnail ? null : <p className="shader-loading-label" role="status">Готовим превью…</p>}>
          <Effect className="shader-effect-renderer" colors={palette.colors} speed={speed} intensity={intensity} paused={!playing} interactive={!thumbnail} style={fill} />
        </Suspense>
      )}
    </div>
  );
}

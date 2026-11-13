"use client";

import * as React from "react";
import { plainFragmentShader } from "./shaders/plain";
import { blurFragmentShader } from "./shaders/blur";
import { ditherFragmentShader } from "./shaders/dither";
import { createLoaderRenderer } from "./renderer";

export type LoaderShape = "sphere" | "swirl" | "ripple";
export type LoaderStyle = "plain" | "blur" | "dither";
export const sizeConfig = { sm: { width: 48, height: 48 }, default: { width: 80, height: 80 }, lg: { width: 120, height: 120 } };

export interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  shape?: LoaderShape;
  variant?: LoaderStyle;
  size?: keyof typeof sizeConfig;
  width?: number;
  height?: number;
  speed?: number;
  color?: string;
  colorBack?: string;
  paused?: boolean;
}

const shapeMap: Record<LoaderShape, number> = { sphere: 1, swirl: 2, ripple: 3 };
const shaderMap: Record<LoaderStyle, string> = { plain: plainFragmentShader, blur: blurFragmentShader, dither: ditherFragmentShader };

// Resolve variables in the loader's own theme scope, including modern CSS color spaces.
function loaderColor(value: string, host: HTMLElement): number[] {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  probe.style.color = value;
  if (!probe.style.color) return [0, 0, 0, 0];
  host.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  const pixel = document.createElement("canvas");
  pixel.width = pixel.height = 1;
  const context = pixel.getContext("2d", { willReadFrequently: true });
  if (!context) return [0, 0, 0, 0];
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  return Array.from(context.getImageData(0, 0, 1, 1).data, channel => channel / 255);
}

export function Loader({
  shape = "sphere", variant = "dither", size = "default", width, height, speed = 1,
  color = "#00b3ff", colorBack = "transparent", paused = false, className, style, children, ...props
}: LoaderProps) {
  const host = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const renderer = React.useRef<ReturnType<typeof createLoaderRenderer>>(null);
  const [ready, setReady] = React.useState(false);
  const [colors, setColors] = React.useState<number[][]>([[0, 0.7, 1, 1], [0, 0, 0, 0]]);
  const fragment = shaderMap[variant];

  React.useEffect(() => {
    const element = host.current;
    if (!element) return;
    const update = () => setColors([loaderColor(color, element), loaderColor(colorBack, element)]);
    update();
    const observer = new MutationObserver(update);
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    }
    const theme = matchMedia("(prefers-color-scheme: dark)");
    theme.addEventListener("change", update);
    return () => { observer.disconnect(); theme.removeEventListener("change", update); };
  }, [color, colorBack]);

  React.useEffect(() => {
    if (!canvas.current) return;
    const instance = createLoaderRenderer(canvas.current, fragment, { uniforms: {
      u_colorFront: [0, 0, 0, 0], u_colorBack: [0, 0, 0, 0], u_shape: 1, u_scale: 0.6, u_pxSize: 2,
    }, speed: 1, paused: true }, setReady);
    renderer.current = instance;
    setReady(Boolean(instance));
    return () => { instance?.dispose(); renderer.current = null; };
  }, [fragment]);

  React.useEffect(() => {
    renderer.current?.configure({
      uniforms: { u_colorFront: colors[0], u_colorBack: colors[1], u_shape: shapeMap[shape], u_scale: variant === "blur" ? 0.52 : 0.6, u_pxSize: 2 },
      speed: Number.isFinite(speed) ? Math.max(0, speed) : 1, paused,
    });
  }, [colors, shape, variant, speed, paused, fragment]);

  return (
    <div ref={host} role="status" aria-label="Загрузка" data-slot="loader" data-renderer={ready ? "ready" : "fallback"} className={className}
      style={{ position: "relative", overflow: "hidden", borderRadius: "50%", flexShrink: 0, width: width ?? sizeConfig[size].width, height: height ?? sizeConfig[size].height, ...style }} {...props}>
      <canvas ref={canvas} aria-hidden="true" style={{ display: "block", width: "100%", height: "100%", opacity: ready ? 1 : 0 }} />
      {!ready && <span aria-hidden="true" style={{ position: "absolute", inset: "22%", border: `3px solid ${color}`, borderRightColor: "transparent", borderRadius: "50%", background: colorBack }} />}
      {children}
    </div>
  );
}

export default Loader;

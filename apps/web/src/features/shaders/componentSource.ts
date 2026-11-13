import rendererSource from "./webgl.ts?raw";
import imageTextureSource from "./imageTexture.ts?raw";
import particleVertexSource from "./particleVertex.ts?raw";
import type { Palette, ShaderPreset } from "./presets";

export function componentSource(preset: ShaderPreset, palette: Palette, speed: number, intensity: number, imageSrc = "") {
  const interactive = Boolean(preset.renderer?.pointer);
  const hasImage = Boolean(preset.renderer?.image);
  const options = JSON.stringify({ ...preset.renderer, pointer: undefined });
  const runtime = [imageTextureSource, particleVertexSource, rendererSource]
    .map((source) => source.replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "").trim())
    .join("\n\n");
  return `"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

${runtime}

const fragment = \`${preset.fragment.trim()}\`;
const defaultColors = ${JSON.stringify(palette.colors)} as const;
${hasImage ? `const defaultImage = ${JSON.stringify(imageSrc)};\n` : ""}

type Props = {
  speed?: number;
  intensity?: number;
  colors?: readonly [string, string]; // Use #RRGGBB colors.
  paused?: boolean;
${hasImage ? "  imageSrc?: string; // Same-origin URL, data URL, or a CORS-enabled image.\n" : ""}
${interactive ? "  interactive?: boolean;\n" : ""}  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function ${preset.componentName}({
  speed = ${speed}, intensity = ${intensity}, colors = defaultColors,
  paused = false, ${hasImage ? "imageSrc = defaultImage, " : ""}${interactive ? "interactive = true, " : ""}className, style, children,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createShaderRenderer>>(null);
  const [available, setAvailable] = useState(false);
${hasImage ? '  const [imageStatus, setImageStatus] = useState<ImageTextureStatus>("ready");\n' : ""}
  const [primary, secondary] = colors;

  useEffect(() => {
    if (!canvas.current) return;
    const instance = createShaderRenderer(canvas.current, fragment, {
      colors: defaultColors, speed: 1, intensity: 0, playing: false,
    }, setAvailable, { ...${options}${interactive ? ", pointer: interactive" : ""} }${hasImage ? ", setImageStatus" : ""});
    renderer.current = instance;
    setAvailable(Boolean(instance));
    return () => {
      instance?.dispose();
      renderer.current = null;
    };
  }, [${interactive ? "interactive" : ""}]);

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    function configure() {
      renderer.current?.configure({
        colors: [primary, secondary], speed, intensity, playing: !paused && !motion.matches,${hasImage ? " imageSrc," : ""}
      });
    }
    configure();
    motion.addEventListener("change", configure);
    return () => motion.removeEventListener("change", configure);
  }, [primary, secondary, speed, intensity, paused${interactive ? ", interactive" : ""}${hasImage ? ", imageSrc" : ""}]);

  return (
    <div className={className} style={{
      position: "relative", isolation: "isolate", minHeight: 240, overflow: "hidden",
      background: \`radial-gradient(ellipse at 32% 40%, \${primary}40, transparent 56%), radial-gradient(ellipse at 70% 62%, \${secondary}44, #191620 72%)\`,
      ...style,
    }}>
      <canvas ref={canvas} aria-hidden="true" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: -1,
        pointerEvents: "none", opacity: available ? 1 : 0,
      }} />
${hasImage ? '      {imageStatus === "error" && <p role="status">Image could not be loaded. Check the URL and CORS settings.</p>}\n' : ""}
      {children}
    </div>
  );
}
`;
}

import type { Palette, ShaderPreset } from "./presets";

export function shaderPrompt(preset: ShaderPreset, palette: Palette, speed: number, intensity: number) {
  const { componentName, direction } = preset;
  const [primary, secondary] = palette.colors;

  return `Build and integrate ${componentName}.tsx as a reusable animated background in my React + TypeScript project. Read the project's conventions first. If it already has this component, reuse and adapt it. Use @mtkit/ui for the surrounding interface when it is available and follow the project's existing design tokens.

Visual direction
${direction}
Use ${primary} as the primary color and ${secondary} as the secondary color. Set the default animation speed to ${speed.toFixed(2)}× and the intensity to ${Math.round(intensity * 100)}% (${intensity.toFixed(2)} as a numeric multiplier).

Component API
Export a named ${componentName} component with typed speed, intensity, colors, paused, className, style and children props.${preset.renderer?.pointer ? " Include an interactive prop to disable the pointer effect." : ""}${preset.renderer?.image ? " Include an imageSrc prop for a same-origin, data URL or CORS-enabled image. Bound the uploaded texture size, handle image load failure, cancel stale loads and release textures on unmount. The built-in demo must work without network access. Do not upload local images to a server." : ""} The background should fill its container, stay behind the children and leave their pointer and keyboard interactions intact. Include one example placing real page content over it.

Rendering and checks
Use a decorative WebGL canvas with ${preset.renderer?.particles ? "a bounded GL_POINTS grid, vertex-shader motion and colors sampled from the image" : preset.renderer?.image ? "a fragment shader sampling the image texture" : "procedural GLSL"}. Cap the backing resolution, suspend rendering offscreen and in hidden tabs, and use a static frame for prefers-reduced-motion. Provide a matching CSS fallback for unavailable WebGL and clean up GPU resources and observers on unmount. Check the rendered result on desktop and mobile for contrast, clipping and smooth motion. Run the project's TypeScript check.`;
}

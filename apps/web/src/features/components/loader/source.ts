import loader from "./Loader.tsx?raw";
import renderer from "./renderer.ts?raw";
import vertex from "./shaders/vertex.ts?raw";
import utils from "./shaders/utils.ts?raw";
import plain from "./shaders/plain.ts?raw";
import blur from "./shaders/blur.ts?raw";
import dither from "./shaders/dither.ts?raw";
import type { LoaderProps } from "./Loader";

export function loaderSource(settings: Pick<LoaderProps, "shape" | "variant" | "size" | "color" | "speed" | "paused">) {
  const clean = (source: string) => source.replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "").trim();
  const component = loader.replace(/^"use client";\s*/, "").replace(/^import .*;\r?\n/gm, "").trim();
  return `"use client";

// Shader Loader by asanshay: https://ds.asanshay.com/loader
// Registry: https://ds.asanshay.com/r/loader.json
// MTKit adaptation: scoped CSS colors, motion preferences, bounded rendering,
// visibility suspension, context recovery and static fallback.
import * as React from "react";

${[vertex, utils, plain, blur, dither, renderer].map(clean).join("\n\n")}

${component}

// Example with the settings selected in MTKit Design:
// <Loader {...${JSON.stringify(settings)}} />
`;
}

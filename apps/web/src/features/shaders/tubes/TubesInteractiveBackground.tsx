"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, DynamicDrawUsage, HalfFloatType, Mesh, MeshStandardMaterial,
  OrthographicCamera, PointLight, Scene, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const defaultColors = ["#f967fb", "#53bc28", "#6958d5"] as const;
const defaultSpeed = 1;
const defaultIntensity = 1;
const lightColors = ["#83f36e", "#fe8a2e", "#ff008a", "#60aed5"];
const motionQuery = "(prefers-reduced-motion: reduce)";
const sampleCount = 72;
const tubeCount = 16;
const radialSegments = 6;

type TubesProps = {
  colors?: readonly [string, string, string?];
  speed?: number;
  intensity?: number;
  paused?: boolean;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

type Settings = Required<Pick<TubesProps, "colors" | "speed" | "intensity" | "interactive">> & Pick<TubesProps, "paused">;
type RenderStatus = "loading" | "ready" | "fallback";

function makeTube(index: number) {
  const segments = 48;
  const radius = 0.0035 + ((index * 7) % tubeCount) * 0.00040;
  const angle = index * 2.39996;
  const length = 0.58 + 0.42 * ((index * 11) % tubeCount) / (tubeCount - 1);
  const ringWidth = radialSegments + 1;
  const positions = new Float32Array((segments + 1) * ringWidth * 3);
  const normals = new Float32Array(positions.length);
  const indices = [];
  for (let row = 0; row < segments; row++) {
    for (let face = 0; face < radialSegments; face++) {
      const a = row * ringWidth + face;
      const b = a + ringWidth;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geometry = new BufferGeometry();
  const position = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
  const normal = new BufferAttribute(normals, 3).setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", position);
  geometry.setAttribute("normal", normal);
  geometry.setIndex(indices);
  const material = new MeshStandardMaterial({ metalness: 0.81, roughness: 0.22 });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;

  const centers = Array.from({ length: segments + 1 }, () => new Vector3());
  const tangent = new Vector3();
  const sideways = new Vector3();
  const other = new Vector3();
  const direction = new Vector3();
  const zAxis = new Vector3(0, 0, 1);
  const ring = Array.from({ length: ringWidth }, (_, i) => {
    const a = i * Math.PI * 2 / radialSegments;
    return [Math.cos(a), Math.sin(a)] as const;
  });

  return {
    mesh,
    setColor(color: Color) {
      material.color.copy(color);
      material.emissive.copy(color);
    },
    update(trail: CatmullRomCurve3, time: number, intensity: number) {
      material.emissiveIntensity = 0.1 * intensity;
      for (let row = 0; row <= segments; row++) {
        const fraction = row / segments;
        const wave = angle + fraction * 6.5 + time * 1.6;
        const separation = 0.002 + fraction * fraction * 0.028;
        const center = trail.getPoint(fraction * length, centers[row]);
        center.x += Math.cos(wave) * separation;
        center.y += Math.sin(wave * 1.13 + angle * 0.37) * separation;
        center.z = Math.sin(wave * 0.71) * separation * 2;
      }
      for (let row = 0; row <= segments; row++) {
        const center = centers[row];
        tangent.subVectors(centers[Math.min(row + 1, segments)], centers[Math.max(0, row - 1)]).normalize();
        sideways.crossVectors(zAxis, tangent).normalize();
        other.crossVectors(sideways, tangent).normalize();
        const taper = Math.max(0.02, Math.sin(row * Math.PI / segments));
        for (let face = 0; face < ringWidth; face++) {
          const [cos, sin] = ring[face];
          direction.copy(sideways).multiplyScalar(cos).addScaledVector(other, sin);
          const offset = (row * ringWidth + face) * 3;
          normals[offset] = direction.x;
          normals[offset + 1] = direction.y;
          normals[offset + 2] = direction.z;
          positions[offset] = center.x + direction.x * radius * taper;
          positions[offset + 1] = center.y + direction.y * radius * taper;
          positions[offset + 2] = center.z + direction.z * radius * taper;
        }
      }
      position.needsUpdate = true;
      normal.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

function orbit(time: number, target: Vector3) {
  return target.set(Math.sin(time * 1.55) * 0.72, Math.sin(time * 2.83) * 0.28, 0);
}

function makeRenderer(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: "low-power" });
  const scene = new Scene();
  scene.background = new Color("#000000");
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  camera.position.z = 4;
  const tubes = Array.from({ length: tubeCount }, (_, index) => makeTube(index));
  tubes.forEach(({ mesh }) => scene.add(mesh));
  const lights = lightColors.map((color, index) => {
    const light = new PointLight(color, 4.7);
    light.position.set(index < 2 ? -1.1 : 1.1, index % 2 ? 0.82 : -0.82, 1.18);
    scene.add(light);
    return light;
  });

  const targetBuffer = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
  const gl = renderer.getContext();
  if ("getInternalformatParameter" in gl && gl.getExtension("EXT_color_buffer_float")) {
    const samples: Int32Array = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES);
    targetBuffer.samples = Math.min(4, samples[0] ?? 0);
  }
  const composer = new EffectComposer(renderer, targetBuffer);
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new Vector2(1, 1), 0.83, 0.24, 0.075);
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  let elapsed = 0.96;
  let accumulated = 0;
  const trail = Array.from({ length: sampleCount }, (_, index) => orbit(elapsed - index * 0.013, new Vector3()));
  const curve = new CatmullRomCurve3(trail, false, "catmullrom", 0.4);
  const target = new Vector3();
  const cursor = new Vector3();
  const head = trail[0].clone();
  const sample = new Vector3();
  const color = new Color();
  let aspect = 1;
  let hovering = false;
  let lastMove = 0;
  let pointerWeight = 0;
  let palette = { colors: defaultColors as readonly string[], lights: lightColors as readonly string[] };
  function applyColors(colors: readonly string[], lightPalette: readonly string[]) {
    palette = { colors, lights: lightPalette };
    const shades = colors.map((value) => new Color(value));
    tubes.forEach((tube, i) => {
      const blend = i * (shades.length - 1) / (tubeCount - 1);
      const lower = Math.floor(blend);
      tube.setColor(color.copy(shades[lower]).lerp(shades[Math.min(lower + 1, shades.length - 1)], blend - lower));
    });
    lights.forEach((light, index) => light.color.set(lightPalette[index]));
  }

  function draw(intensity: number) {
    const pointerLight = pointerWeight * Math.exp(-Math.max(0, elapsed - lastMove - 0.2) * 1.8);
    lights.forEach((light) => { light.intensity = (5.4 + pointerLight * 2.8) * intensity; });
    tubes.forEach((tube) => tube.update(curve, elapsed, intensity));
    composer.render();
  }

  function advanceTrail() {
    const spacing = 0.025;
    const distance = trail[0].distanceTo(head);
    const steps = Math.min(trail.length - 1, Math.floor(distance / spacing));
    if (!steps) return;
    sample.copy(trail[0]);
    for (let i = trail.length - 1; i >= steps; i--) trail[i].copy(trail[i - steps]);
    for (let i = 0; i < steps; i++) trail[i].lerpVectors(sample, head, (steps - i) * spacing / distance);
  }

  return {
    applyColors,
    draw,
    get palette() { return palette; },
    move(clientX: number, clientY: number) {
      const { left, top, width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      hovering = true;
      lastMove = elapsed;
      cursor.set(((clientX - left) / width * 2 - 1) * aspect, 1 - (clientY - top) / height * 2, 0).multiplyScalar(camera.top);
    },
    leave() { hovering = false; },
    randomizeColors() {
      const nextColor = () => "#" + Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, "0");
      applyColors(Array.from({ length: 3 }, nextColor), Array.from({ length: 4 }, nextColor));
    },
    resize(width: number, height: number) {
      aspect = width / height;
      const heightScale = Math.max(1, 0.94 / aspect);
      camera.left = -aspect * heightScale;
      camera.right = aspect * heightScale;
      camera.top = heightScale;
      camera.bottom = -heightScale;
      camera.updateProjectionMatrix();
      const pixelRatio = Math.min(Math.max(1.25, window.devicePixelRatio), 1.5, Math.sqrt(1_150_000 / (width * height)));
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    tick(dt: number, settings: Settings) {
      const step = 1 / 50;
      accumulated += Math.min(0.05, dt) * settings.speed;
      if (accumulated < step) return;
      while (accumulated >= step) {
        accumulated -= step;
        elapsed += step;
        const tracking = hovering && settings.interactive;
        pointerWeight += (Number(tracking) - pointerWeight) * (tracking ? 0.33 : 0.09);
        head.lerp(orbit(elapsed, target).lerp(cursor, pointerWeight), 0.6);
        // Gradually pull the old path toward the head when hovering at rest.
        const settle = pointerWeight * Math.min(0.14, Math.max(0, elapsed - lastMove - 0.4) * 0.1);
        for (let i = trail.length - 1; i > 0; i--) trail[i].lerp(trail[i - 1], settle);
        advanceTrail();
      }
      draw(settings.intensity);
    },
    dispose() {
      tubes.forEach((tube) => tube.dispose());
      renderPass.dispose();
      bloomPass.dispose();
      outputPass.dispose();
      composer.dispose();
      renderer.dispose();
      queueMicrotask(() => {
        if (!canvas.isConnected) renderer.forceContextLoss();
      });
    },
  };
}

export function TubesInteractiveBackground({
  colors = defaultColors, speed = defaultSpeed, intensity = defaultIntensity,
  paused, interactive = true, className, style, children,
}: TubesProps) {
  const surface = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<RenderStatus>("loading");
  const safeSpeed = Number.isFinite(speed) ? Math.min(4, Math.max(0, speed)) : defaultSpeed;
  const safeIntensity = Number.isFinite(intensity) ? Math.min(4, Math.max(0, intensity)) : defaultIntensity;
  const settings = useRef<Settings>({ colors, speed: safeSpeed, intensity: safeIntensity, paused, interactive });
  const runtime = useRef<{ configure(next: Settings): void } | null>(null);
  const [first, second, third] = colors;

  useEffect(() => {
    const previous = settings.current.colors;
    const nextColors = previous[0] === first && previous[1] === second && previous[2] === third
      ? previous : [first, second, third] as const;
    settings.current = { colors: nextColors, speed: safeSpeed, intensity: safeIntensity, paused, interactive };
    runtime.current?.configure(settings.current);
  }, [first, second, third, safeSpeed, safeIntensity, paused, interactive]);

  useEffect(() => {
    const element = canvas.current;
    const container = surface.current;
    if (!element || !container) return;
    const motion = matchMedia(motionQuery);
    let visible = false;
    let crashed = false;
    let frame = 0;
    let lastTime: number | undefined;
    let instance: ReturnType<typeof makeRenderer> | undefined;
    let previousPalette: ReturnType<typeof makeRenderer>["palette"] | undefined;
    let appliedColors = settings.current.colors;
    const isPlaying = () => !(settings.current.paused ?? motion.matches);

    function schedule() {
      if (!instance || crashed || !visible || document.hidden || !isPlaying()) {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = undefined;
      } else if (!frame) {
        frame = requestAnimationFrame(update);
      }
    }

    function update(now: number) {
      frame = 0;
      if (lastTime !== undefined) instance?.tick((now - lastTime) / 1000, settings.current);
      lastTime = now;
      schedule();
    }

    function resize() {
      if (!container || !instance || crashed) return;
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      instance.resize(width, height);
      instance.draw(settings.current.intensity);
    }

    function loseContext(event: Event) {
      event.preventDefault();
      crashed = true;
      setStatus("fallback");
      schedule();
      previousPalette = instance?.palette;
      instance?.dispose();
      instance = undefined;
    }

    function restoreContext() {
      crashed = false;
      if (visible) initialize();
      schedule();
    }

    function initialize() {
      if (!element || instance || crashed) return;
      try {
        instance = makeRenderer(element);
        const colors = settings.current.colors;
        const palette = colors === appliedColors ? previousPalette : undefined;
        appliedColors = colors;
        instance.applyColors(palette?.colors ?? colors.filter((value): value is string => Boolean(value)), palette?.lights ?? lightColors);
        previousPalette = undefined;
        resize();
        setStatus("ready");
      } catch {
        crashed = true;
        instance?.dispose();
        instance = undefined;
        setStatus("fallback");
      }
    }

    function move(event: PointerEvent) {
      if (event.isPrimary && settings.current.interactive && isPlaying()) instance?.move(event.clientX, event.clientY);
    }

    function leave(event: PointerEvent) {
      if (event.isPrimary) instance?.leave();
    }

    function press(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0 || (event.target instanceof Element && event.target.closest("a, button, input, select, textarea, [contenteditable], [role=button]"))) return;
      if (!settings.current.interactive || !isPlaying()) return;
      move(event);
      instance?.randomizeColors();
      instance?.draw(settings.current.intensity);
    }

    function release(event: PointerEvent) {
      if (event.pointerType !== "mouse") leave(event);
    }

    // Defer GPU initialization until the preview enters the viewport.
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) initialize();
      schedule();
    });
    const resizeObserver = new ResizeObserver(resize);
    intersection.observe(container);
    resizeObserver.observe(container);
    runtime.current = {
      configure(next) {
        if (instance && !crashed) {
          if (next.colors !== appliedColors) {
            appliedColors = next.colors;
            instance.applyColors(next.colors.filter((value): value is string => Boolean(value)), lightColors);
          }
          instance.draw(next.intensity);
        }
        schedule();
      },
    };
    motion.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", schedule);
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerdown", press);
    container.addEventListener("pointerup", release);
    container.addEventListener("pointercancel", leave);
    container.addEventListener("pointerleave", leave);
    element.addEventListener("webglcontextlost", loseContext);
    element.addEventListener("webglcontextrestored", restoreContext);
    return () => {
      runtime.current = null;
      cancelAnimationFrame(frame);
      intersection.disconnect();
      resizeObserver.disconnect();
      motion.removeEventListener("change", schedule);
      document.removeEventListener("visibilitychange", schedule);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerdown", press);
      container.removeEventListener("pointerup", release);
      container.removeEventListener("pointercancel", leave);
      container.removeEventListener("pointerleave", leave);
      element.removeEventListener("webglcontextlost", loseContext);
      element.removeEventListener("webglcontextrestored", restoreContext);
      instance?.dispose();
    };
  }, []);

  return (
    <div ref={surface} className={className} data-renderer={status} style={{
      position: "relative", isolation: "isolate", minHeight: 240, overflow: "hidden",
      background: `radial-gradient(ellipse at 41% 48%, ${first}29, transparent 46%), radial-gradient(ellipse at 64% 52%, ${second}22, black 67%)`,
      touchAction: interactive ? "none" : undefined,
      ...style,
    }}>
      <canvas ref={canvas} aria-hidden="true" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: -1,
        pointerEvents: "none", opacity: status === "ready" ? 1 : 0,
      }} />
      {children}
    </div>
  );
}

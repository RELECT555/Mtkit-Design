"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const defaultColors = ["#5227FF", "#FF9FFC", "#B19EEF"] as const;
const defaultSpeed = 1;
const defaultIntensity = 1;

type Palette = readonly [string, string, string?];
type Point = readonly [number, number];
type Color = readonly [number, number, number];
type Settings = { colors: Palette; speed: number; intensity: number; playing: boolean; interactive: boolean };

// Visual reference: Superdesign's Liquid Ether preview by Zhou Jason.
// This implementation evolves its own velocity field with advection and pressure projection.
const vertex = `#version 300 es
out vec2 uv;
void main() {
  vec2 position = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  uv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}
`;

const head = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 result;
uniform sampler2D field;
uniform sampler2D auxiliary;
uniform vec2 cell;
vec2 velocity(vec2 point) { return texture(field, point).xy; }
float samplePressure(vec2 point) { return texture(auxiliary, point).r; }
vec2 trace(vec2 point, float step) {
  vec2 aspect = vec2(cell.y / cell.x, 1.0);
  vec2 midpoint = point - velocity(point) * (step * 0.5) / aspect;
  return point - velocity(midpoint) * step / aspect;
}
`;

const kernels = {
  seed: `
    vec2 vortex(vec2 p, vec2 center, float width) {
      vec2 d = p - center;
      return vec2(d.y, -d.x) * exp(-dot(d, d) / (width * width));
    }
    void main() {
      vec2 aspect = vec2(cell.y / cell.x, 1.0);
      vec2 p = (uv - vec2(0.62, 0.44)) * aspect;
      float width = min(0.26, aspect.x * 0.25);
      vec2 flow = 4.7 * vortex(p, vec2(-width * 0.21, -width * 0.24), width)
        - 3.0 * vortex(p, vec2(width * 0.59, width * 0.48), width * 1.37);
      flow += vec2(0.11, -0.04) * exp(-dot(p, p) / (3.0 * width * width));
      result = vec4(flow, 0.0, 1.0);
    }`,
  transport: `
    uniform float timeStep;
    void main() {
      result = vec4(velocity(trace(uv, timeStep)), 0.0, 1.0);
    }`,
  curl: `
    void main() {
      float dx = velocity(uv + vec2(cell.x, 0.0)).y - velocity(uv - vec2(cell.x, 0.0)).y;
      float dy = velocity(uv + vec2(0.0, cell.y)).x - velocity(uv - vec2(0.0, cell.y)).x;
      result = vec4(0.5 * (dx - dy), 0.0, 0.0, 1.0);
    }`,
  correct: `
    uniform sampler2D vorticity;
    uniform float timeStep;
    uniform float radius;
    uniform vec2 previousSource;
    uniform vec2 source;
    uniform vec2 impulse;
    void main() {
      vec2 aspect = vec2(cell.y / cell.x, 1.0);
      vec2 origin = trace(uv, timeStep);
      vec2 forward = texture(auxiliary, uv).xy;
      vec2 reverse = texture(auxiliary, trace(uv, -timeStep)).xy;

      // Compensate for the smoothing from backward advection. Bound the
      // correction to the source cell's neighborhood at steep gradients.
      vec2 lower = (floor(origin / cell - 0.5) + 0.5) * cell;
      vec2 a = velocity(lower);
      vec2 b = velocity(lower + vec2(cell.x, 0.0));
      vec2 c = velocity(lower + vec2(0.0, cell.y));
      vec2 d = velocity(lower + cell);
      vec2 minVelocity = min(min(a, b), min(c, d));
      vec2 maxVelocity = max(max(a, b), max(c, d));
      vec2 next = clamp(forward + 0.38 * (velocity(uv) - reverse), minVelocity, maxVelocity);
      next *= exp(-timeStep * 0.94);

      // Concentrated shear rolls into small eddies as the wake unfolds.
      vec2 x = vec2(cell.x, 0.0);
      vec2 y = vec2(0.0, cell.y);
      vec2 gradient = vec2(
        abs(texture(vorticity, uv + x).r) - abs(texture(vorticity, uv - x).r),
        abs(texture(vorticity, uv + y).r) - abs(texture(vorticity, uv - y).r)
      );
      gradient /= max(length(gradient), 0.012);
      float spin = clamp(texture(vorticity, uv).r, -0.18, 0.18);
      next += vec2(gradient.y, -gradient.x) * spin * (timeStep * 2.2);

      // Deposit force along the pointer's path, even when input arrives
      // several samples at a time between animation frames.
      vec2 travel = (source - previousSource) * aspect;
      vec2 offset = (uv - previousSource) * aspect;
      float along = clamp(dot(offset, travel) / max(dot(travel, travel), 0.0001), 0.0, 1.0);
      vec2 distance = (offset - travel * along) / radius;
      float drag = exp(-dot(distance, distance) * 3.5);
      next += impulse * drag * (0.5 + along * 0.5);
      if (uv.x <= cell.x || uv.x >= 1.0 - cell.x) next.x = 0.0;
      if (uv.y <= cell.y || uv.y >= 1.0 - cell.y) next.y = 0.0;
      result = vec4(clamp(next, vec2(-2.5), vec2(2.5)), 0.0, 1.0);
    }`,
  divergence: `
    void main() {
      float dx = velocity(uv + vec2(cell.x, 0.0)).x - velocity(uv - vec2(cell.x, 0.0)).x;
      float dy = velocity(uv + vec2(0.0, cell.y)).y - velocity(uv - vec2(0.0, cell.y)).y;
      result = vec4(0.5 * (dx + dy), 0.0, 0.0, 1.0);
    }`,
  pressure: `
    void main() {
      vec2 x = vec2(cell.x, 0.0);
      vec2 y = vec2(0.0, cell.y);
      float neighbors = samplePressure(uv - x) + samplePressure(uv + x)
        + samplePressure(uv - y) + samplePressure(uv + y);
      result = vec4(0.25 * (neighbors - velocity(uv).r), 0.0, 0.0, 1.0);
    }`,
  project: `
    void main() {
      vec2 x = vec2(cell.x, 0.0);
      vec2 y = vec2(0.0, cell.y);
      vec2 gradient = vec2(samplePressure(uv + x) - samplePressure(uv - x),
        samplePressure(uv + y) - samplePressure(uv - y));
      result = vec4(velocity(uv) - 0.5 * gradient, 0.0, 1.0);
    }`,
  display: `
    uniform vec3 slowColor;
    uniform vec3 midColor;
    uniform vec3 fastColor;
    uniform float brightness;
    void main() {
      float speed = length(velocity(uv)) * brightness;
      float slow = smoothstep(0.0, 0.29, speed);
      float middle = smoothstep(0.19, 0.44, speed);
      float fast = smoothstep(0.46, 0.76, speed);
      vec3 ash = mix(vec3(0.24, 0.25, 0.30), slowColor, slow * 0.27);
      vec3 pink = mix(ash, midColor, middle * 0.68);
      vec3 core = mix(fastColor, vec3(0.29, 0.29, 0.40), 0.22);
      vec3 color = mix(pink, core, fast);
      vec2 lightOffset = cell * vec2(-1.3, 1.9);
      float slope = length(velocity(uv - lightOffset)) - length(velocity(uv + lightOffset));
      float sheen = smoothstep(0.018, 0.115, slope * brightness) * slow * (1.0 - fast);
      color = mix(color, vec3(1.0), sheen * 0.19);
      float alpha = max(slow * 0.57, fast * 0.87);
      result = vec4(color, alpha);
    }`,
};

type Kernel = keyof typeof kernels;
type Target = { texture: WebGLTexture; frame: WebGLFramebuffer };

function colorChannels(hex: string): Color {
  const value = /^#[\da-f]{6}$/i.test(hex) ? Number.parseInt(hex.slice(1), 16) : 0xffffff;
  return [(value >> 16) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function createSimulation(gl: WebGL2RenderingContext) {
  const programs = new Map<Kernel, { program: WebGLProgram; uniforms: Map<string, WebGLUniformLocation | null> }>();
  const targets: Target[] = [];
  let width = 1;
  let height = 1;

  function compile(kind: number, source: string) {
    const shader = gl.createShader(kind);
    if (!shader) throw new Error("Cannot create shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log ?? "Cannot compile shader");
  }

  function addKernel(name: Kernel) {
    const program = gl.createProgram();
    if (!program) throw new Error("Cannot create program");
    programs.set(name, { program, uniforms: new Map() });
    const vs = compile(gl.VERTEX_SHADER, vertex);
    try {
      const fs = compile(gl.FRAGMENT_SHADER, head + kernels[name]);
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Cannot link fluid program");
    } finally {
      gl.deleteShader(vs);
    }
  }

  function clearTargets() {
    for (const { texture, frame } of targets) {
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(frame);
    }
    targets.length = 0;
  }

  function dispose() {
    clearTargets();
    for (const { program } of programs.values()) gl.deleteProgram(program);
    programs.clear();
  }

  function makeTarget(channels: "scalar" | "vector") {
    const texture = gl.createTexture();
    const frame = gl.createFramebuffer();
    if (!texture || !frame) {
      if (texture) gl.deleteTexture(texture);
      if (frame) gl.deleteFramebuffer(frame);
      throw new Error("Cannot allocate fluid target");
    }

    const target = { texture, frame };
    targets.push(target);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, channels === "scalar" ? gl.R16F : gl.RG16F, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, frame);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("Cannot render into fluid target");
    }
    return target;
  }

  function pass(name: Kernel, target: Target | null, field: Target | null, auxiliary: Target | null,
    values: Record<string, number | Point | Color> = {}, vorticity?: Target) {
    const entry = programs.get(name);
    if (!entry) throw new Error("Missing fluid program");
    const { program, uniforms } = entry;
    function uniform(key: string) {
      if (!uniforms.has(key)) uniforms.set(key, gl.getUniformLocation(program, key));
      return uniforms.get(key) ?? null;
    }
    gl.useProgram(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.frame ?? null);
    gl.viewport(0, 0, target ? width : gl.drawingBufferWidth, target ? height : gl.drawingBufferHeight);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, field?.texture ?? null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, auxiliary?.texture ?? null);
    gl.uniform1i(uniform("field"), 0);
    gl.uniform1i(uniform("auxiliary"), 1);
    if (vorticity) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, vorticity.texture);
      gl.uniform1i(uniform("vorticity"), 2);
    }
    gl.uniform2f(uniform("cell"), 1 / width, 1 / height);
    for (const [key, value] of Object.entries(values)) {
      const location = uniform(key);
      if (typeof value === "number") gl.uniform1f(location, value);
      else if (value.length === 2) gl.uniform2f(location, ...value);
      else gl.uniform3f(location, ...value);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  try {
    for (const name of Object.keys(kernels) as Kernel[]) addKernel(name);
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    resize(cssWidth: number, cssHeight: number) {
      const scale = Math.min(0.6, 420 / Math.max(cssWidth, cssHeight), Math.sqrt(84000 / (cssWidth * cssHeight)));
      const nextWidth = Math.max(2, Math.round(cssWidth * scale));
      const nextHeight = Math.max(2, Math.round(cssHeight * scale));
      if (targets.length && width === nextWidth && height === nextHeight) return;
      width = nextWidth;
      height = nextHeight;
      clearTargets();
      makeTarget("vector");
      makeTarget("vector");
      makeTarget("vector");
      makeTarget("scalar");
      makeTarget("scalar");
      makeTarget("scalar");
      makeTarget("scalar");
      pass("seed", targets[0], null, null);
    },
    step(timeStep: number, previousSource: Point, source: Point, impulse: Point, radius: number) {
      const [velocity, transported, corrected, vorticity, divergence, firstPressure, secondPressure] = targets;
      pass("transport", transported, velocity, null, { timeStep });
      pass("curl", vorticity, velocity, null);
      pass("correct", corrected, velocity, transported, { timeStep, previousSource, source, impulse, radius }, vorticity);
      pass("divergence", divergence, corrected, null);
      let previous = firstPressure;
      let next = secondPressure;
      for (let i = 0; i < 14; i++) {
        pass("pressure", next, divergence, previous);
        [previous, next] = [next, previous];
      }
      pass("project", velocity, corrected, previous);
    },
    draw(colors: Palette, intensity: number) {
      if (!targets.length) return;
      pass("display", null, targets[0], null, {
        slowColor: colorChannels(colors[2] ?? colors[1]),
        midColor: colorChannels(colors[1]),
        fastColor: colorChannels(colors[0]),
        brightness: intensity,
      });
    },
    dispose,
  };
}

function mountFluid(canvas: HTMLCanvasElement, container: HTMLElement, initial: Settings,
  report: (status: "ready" | "fallback") => void) {
  const context = canvas.getContext("webgl2", {
    alpha: true, depth: false, antialias: false, premultipliedAlpha: false, powerPreference: "low-power",
  });
  if (!context?.getExtension("EXT_color_buffer_float")) {
    report("fallback");
    return;
  }
  const gl = context;

  let sim: ReturnType<typeof createSimulation> | undefined;
  let settings = initial;
  let cssWidth = 0;
  let cssHeight = 0;
  let visible = false;
  let frame = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let lastInput = -Infinity;
  let mouse: Point | undefined;
  let source: Point = [0.6, 0.48];
  let previousSource = source;
  let pending: Point = [0, 0];

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
  }

  function draw() {
    sim?.draw(settings.colors, settings.intensity);
  }

  function schedule() {
    if (!visible || document.hidden || !settings.playing || !settings.speed || !sim || !cssWidth || !cssHeight) {
      stop();
      return;
    }
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function tick(now: number) {
    frame = 0;
    const dt = Math.min(0.038, (lastFrame ? (now - lastFrame) / 1000 : 1 / 60) * settings.speed);
    lastFrame = now;
    elapsed += dt;
    const aspect = cssWidth / cssHeight;
    let impulse: Point = pending;
    pending = [0, 0];
    if (now - lastInput > 1000) {
      const target: Point = [
        0.5 + 0.35 * Math.sin(elapsed * 1.25 + 0.15 * Math.sin(elapsed * 0.7)),
        0.5 + 0.30 * Math.sin(elapsed * 1.73 + 0.49),
      ];
      const follow = Math.min(1, dt * 3.6);
      const dx = (target[0] - source[0]) * follow;
      const dy = (target[1] - source[1]) * follow;
      source = [source[0] + dx, source[1] + dy];
      impulse = [dx * aspect * 6.0, dy * 6.0];
    }
    sim?.step(dt, previousSource, source, impulse, Math.min(0.21, 100 / cssHeight, aspect * 0.30));
    previousSource = source;
    draw();
    schedule();
  }

  function resize() {
    cssWidth = canvas.clientWidth;
    cssHeight = canvas.clientHeight;
    if (!sim || !cssWidth || !cssHeight) return;
    const scale = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(900000 / (cssWidth * cssHeight)));
    canvas.width = Math.max(1, Math.floor(cssWidth * scale));
    canvas.height = Math.max(1, Math.floor(cssHeight * scale));
    try {
      sim.resize(cssWidth, cssHeight);
      draw();
      schedule();
    } catch {
      stop();
      sim.dispose();
      sim = undefined;
      report("fallback");
    }
  }

  function start() {
    try {
      sim = createSimulation(gl);
      resize();
      if (sim) report("ready");
    } catch {
      report("fallback");
    }
  }

  function move(event: PointerEvent) {
    if (!settings.interactive || !settings.playing || !cssWidth || !cssHeight) return;
    if (event.pointerType !== "mouse" && !event.isPrimary) return;
    if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, [role=button]")) {
      mouse = undefined;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const point: Point = [
      Math.max(0, Math.min(1, (event.clientX - rect.left) / (rect.width || 1))),
      Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / (rect.height || 1))),
    ];
    if (mouse) {
      const x = pending[0] + 9.0 * (point[0] - mouse[0]) * cssWidth / cssHeight;
      const y = pending[1] + 9.0 * (point[1] - mouse[1]);
      const cap = Math.max(1, Math.hypot(x, y) / 0.76);
      pending = [x / cap, y / cap];
    } else {
      previousSource = point;
    }
    mouse = point;
    source = point;
    lastInput = performance.now();
  }

  function release(event: PointerEvent) {
    if (event.type !== "pointerup" || event.pointerType !== "mouse") mouse = undefined;
  }

  function lost(event: Event) {
    event.preventDefault();
    stop();
    sim?.dispose();
    sim = undefined;
    report("fallback");
  }

  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  });
  const size = new ResizeObserver(resize);
  size.observe(canvas);
  intersection.observe(canvas);
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", start);
  document.addEventListener("visibilitychange", schedule);
  container.addEventListener("pointermove", move);
  container.addEventListener("pointerdown", move);
  container.addEventListener("pointerleave", release);
  container.addEventListener("pointerup", release);
  container.addEventListener("pointercancel", release);
  start();

  return {
    configure(next: Settings) {
      settings = next;
      if (!settings.playing || !settings.speed || !settings.interactive) {
        pending = [0, 0];
        mouse = undefined;
      }
      draw();
      schedule();
    },
    dispose() {
      stop();
      size.disconnect();
      intersection.disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", start);
      document.removeEventListener("visibilitychange", schedule);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerdown", move);
      container.removeEventListener("pointerleave", release);
      container.removeEventListener("pointerup", release);
      container.removeEventListener("pointercancel", release);
      sim?.dispose();
      queueMicrotask(() => {
        if (!canvas.isConnected) gl.getExtension("WEBGL_lose_context")?.loseContext();
      });
    },
  };
}

type Props = {
  colors?: Palette;
  speed?: number;
  intensity?: number;
  paused?: boolean;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function LiquidEtherBackground({
  colors = defaultColors,
  speed = defaultSpeed,
  intensity = defaultIntensity,
  paused,
  interactive = true,
  className,
  style,
  children,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const renderer = useRef<ReturnType<typeof mountFluid>>(undefined);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [ready, setReady] = useState(false);
  const [fast, mid, slow] = colors;

  useEffect(() => {
    const element = canvas.current;
    const container = root.current;
    if (!element || !container) return;
    const ready = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      ready.disconnect();
      renderer.current = mountFluid(element, container, {
        colors: defaultColors, speed: defaultSpeed, intensity: defaultIntensity, playing: false, interactive: false,
      }, setStatus);
      setReady(true);
    }, { rootMargin: "40px" });
    ready.observe(element);
    return () => {
      ready.disconnect();
      renderer.current?.dispose();
      renderer.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    function configure() {
      renderer.current?.configure({
        colors: [fast, mid, slow],
        speed: Number.isFinite(speed) ? Math.max(0, Math.min(4, speed)) : defaultSpeed,
        intensity: Number.isFinite(intensity) ? Math.max(0, Math.min(4, intensity)) : defaultIntensity,
        playing: !(paused ?? motion.matches),
        interactive,
      });
    }
    configure();
    motion.addEventListener("change", configure);
    return () => motion.removeEventListener("change", configure);
  }, [fast, mid, slow, speed, intensity, paused, interactive, ready]);

  return (
    <div ref={root} className={className} data-renderer={status} style={{
      position: "relative", isolation: "isolate", overflow: "hidden", minHeight: 240,
      touchAction: interactive ? "none" : undefined,
      ...style,
    }}>
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none",
        background: status === "fallback"
          ? `radial-gradient(ellipse at 63% 53%, ${fast}bf, ${mid}72 11%, ${slow ?? mid}45 30%, transparent 63%)`
          : undefined,
      }}>
        <canvas ref={canvas} style={{ display: "block", width: "100%", height: "100%", opacity: status === "ready" ? 1 : 0 }} />
      </div>
      {children}
    </div>
  );
}

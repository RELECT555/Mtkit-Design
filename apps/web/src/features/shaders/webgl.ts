import { createImageTexture, type ImageTextureStatus } from "./imageTexture";
import { particleVertex } from "./particleVertex";

type ShaderSettings = {
  speed: number;
  intensity: number;
  colors: readonly [string, string];
  playing: boolean;
  imageSrc?: string;
};

export type ShaderRendererOptions = {
  pointer?: boolean;
  glyphs?: boolean;
  renderScale?: number;
  image?: boolean;
  particles?: boolean;
  trail?: boolean;
  boost?: boolean;
  previewPointer?: boolean;
};

const glyphRamp = ".,:;!^~-=+<>/()[]{}|ilrtvxyzLJYUXZ01owmbkqdpOQWMA#%&@";

const vertexSource = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

function rgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255] as const;
}

function compileShader(gl: WebGLRenderingContext, kind: number, source: string) {
  const shader = gl.createShader(kind);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function makeGlyphAtlas(gl: WebGLRenderingContext) {
  const atlas = document.createElement("canvas");
  const cellWidth = 24;
  atlas.width = cellWidth * glyphRamp.length;
  atlas.height = 36;
  const context = atlas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "white";
  context.font = "bold 29px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (let i = 0; i < glyphRamp.length; i++) {
    context.fillText(glyphRamp[i], (i + 0.5) * cellWidth, atlas.height / 2 + 1);
  }

  const texture = gl.createTexture();
  if (!texture) return null;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function makePipeline(gl: WebGLRenderingContext, fragment: string, options: ShaderRendererOptions, redraw: () => void, reportImage: (status: ImageTextureStatus) => void) {
  const { glyphs, particles } = options;
  const vertex = compileShader(gl, gl.VERTEX_SHADER, particles ? particleVertex : vertexSource);
  const pixel = compileShader(gl, gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  if (program && vertex && pixel) {
    gl.attachShader(program, vertex);
    gl.attachShader(program, pixel);
    gl.linkProgram(program);
  }
  if (vertex) gl.deleteShader(vertex);
  if (pixel) gl.deleteShader(pixel);
  if (!program) return null;
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    return null;
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const columns = 384;
  const rows = 256;
  const count = particles ? columns * rows : 3;
  const positions = particles ? new Float32Array(count * 2) : new Float32Array([-1, -1, 3, -1, -1, 3]);
  if (particles) {
    for (let i = 0; i < count; i++) {
      positions[i * 2] = ((i % columns) + 0.5) / columns;
      positions[i * 2 + 1] = (Math.floor(i / columns) + 0.5) / rows;
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.025, 0.02, 0.04, 1);
  }
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const resolution = gl.getUniformLocation(program, "u_resolution");
  const cssSize = gl.getUniformLocation(program, "u_cssSize");
  const cursor = gl.getUniformLocation(program, "u_pointer");
  const cursorMotion = gl.getUniformLocation(program, "u_pointerMotion");
  const time = gl.getUniformLocation(program, "u_time");
  const intensity = gl.getUniformLocation(program, "u_intensity");
  const primary = gl.getUniformLocation(program, "u_primary");
  const secondary = gl.getUniformLocation(program, "u_secondary");
  const trail = gl.getUniformLocation(program, "u_trail[0]");
  const imageSize = gl.getUniformLocation(program, "u_imageSize");
  const image = options.image ? createImageTexture(gl, redraw, reportImage) : null;
  if (image) gl.uniform1i(gl.getUniformLocation(program, "u_image"), 1);
  const atlas = glyphs ? makeGlyphAtlas(gl) : null;
  if (glyphs && !atlas) {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    return null;
  }
  if (atlas) {
    gl.uniform1i(gl.getUniformLocation(program, "u_glyphs"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "u_glyphCount"), glyphRamp.length);
  }

  return {
    tracksMotion: cursorMotion !== null,
    resize(width: number, height: number, cssWidth: number, cssHeight: number) {
      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolution, width, height);
      gl.uniform2f(cssSize, cssWidth, cssHeight);
    },
    configure(settings: ShaderSettings) {
      gl.uniform1f(intensity, settings.intensity);
      gl.uniform3f(primary, ...rgb(settings.colors[0]));
      gl.uniform3f(secondary, ...rgb(settings.colors[1]));
      image?.configure(settings.imageSrc);
    },
    draw(seconds: number, x: number, y: number, influence: number, pulse: number, motionX: number, motionY: number, trailPoints: Float32Array) {
      gl.uniform1f(time, seconds);
      gl.uniform4f(cursor, x, y, influence, pulse);
      gl.uniform2f(cursorMotion, motionX, motionY);
      if (trail) gl.uniform3fv(trail, trailPoints);
      if (image) gl.uniform2f(imageSize, ...image.size);
      if (particles) gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(particles ? gl.POINTS : gl.TRIANGLES, 0, count);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      if (atlas) gl.deleteTexture(atlas);
      image?.dispose();
    },
  };
}

export function createShaderRenderer(
  canvas: HTMLCanvasElement,
  fragment: string,
  initial: ShaderSettings,
  onAvailability: (available: boolean) => void,
  options: ShaderRendererOptions = {},
  onImageStatus: (status: ImageTextureStatus) => void = () => {},
) {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false });
  if (!gl) return null;

  let pipeline = makePipeline(gl, fragment, options, draw, onImageStatus);
  if (!pipeline) return null;

  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  let settings = initial;
  let visible = false;
  let frame = 0;
  let previousTime: number | undefined;
  let elapsed = 0;
  const target = options.pointer ? canvas.parentElement : null;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let motionX = 0;
  let motionY = 0;
  let gustX = 0;
  let gustY = 0;
  let lastMove = 0;
  let influence = 0;
  let pulse = 0;
  let hover = false;
  const trailPoints = new Float32Array(12 * 3);
  if (options.previewPointer) {
    pointerX = 0.64;
    pointerY = 0.54;
    influence = 0.85;
    for (let i = 0; i < 12; i++) {
      trailPoints[i * 3] = pointerX - i * 0.006;
      trailPoints[i * 3 + 1] = pointerY - i * 0.003;
      trailPoints[i * 3 + 2] = influence * (1 - i / 22);
    }
  }

  function draw() {
    pipeline?.draw(elapsed, pointerX, pointerY, influence, pulse, motionX, motionY, trailPoints);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = undefined;
  }

  function schedule() {
    if (!pipeline || !visible || !settings.playing || document.hidden) {
      stop();
      return;
    }
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function tick(now: number) {
    frame = 0;
    if (previousTime !== undefined) {
      const dt = Math.min((now - previousTime) / 1000, 0.1);
      elapsed += dt * settings.speed * (1 + (options.boost ? pulse * 6 : 0));
      if (options.previewPointer) {
        // A bounded demonstration makes image effects readable in gallery cards.
        pointerX = 0.5 + Math.cos(elapsed * 0.46) * 0.14;
        pointerY = 0.5 + Math.sin(elapsed * 0.62 + 0.3) * 0.13;
      } else {
        influence += (Number(hover) - influence) * (1 - Math.exp(-dt * (hover ? 25 : 6)));
      }
      const follow = 1 - Math.exp(-dt * 20);
      motionX += (gustX - motionX) * follow;
      motionY += (gustY - motionY) * follow;
      const settle = Math.exp(-dt * 4.1);
      gustX *= settle;
      gustY *= settle;
      pulse *= Math.exp(-dt * 2.2);
      if (options.trail) {
        for (let i = 0; i < 12; i++) {
          const offset = i * 3;
          const followTrail = 1 - Math.exp(-dt * (i === 0 ? 30 : 36) * settings.speed);
          const x = i === 0 ? pointerX : trailPoints[offset - 3];
          const y = i === 0 ? pointerY : trailPoints[offset - 2];
          trailPoints[offset] += (x - trailPoints[offset]) * followTrail;
          trailPoints[offset + 1] += (y - trailPoints[offset + 1]) * followTrail;
          trailPoints[offset + 2] = influence * (1 - i / 22);
        }
      }
    }
    previousTime = now;
    draw();
    schedule();
  }

  function resize() {
    if (!pipeline) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const density = Math.min(window.devicePixelRatio || 1, 1.5) * (options.renderScale ?? 1);
    const scale = Math.min(density, Math.sqrt(900_000 / (width * height)), maxTextureSize / Math.max(width, height));
    canvas.width = Math.max(1, Math.floor(width * scale));
    canvas.height = Math.max(1, Math.floor(height * scale));
    pipeline.resize(canvas.width, canvas.height, width, height);
    draw();
  }

  function configure(next: ShaderSettings) {
    settings = next;
    if (!settings.playing) {
      // Freeze the visible interaction too; pausing must not snap particles home.
      gustX = 0;
      gustY = 0;
      lastMove = 0;
    }
    pipeline?.configure(settings);
    draw();
    schedule();
  }

  function move(event: PointerEvent) {
    if (!settings.playing) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
    const now = performance.now();
    if (!hover && options.trail) {
      for (let i = 0; i < 12; i++) { trailPoints[i * 3] = x; trailPoints[i * 3 + 1] = y; }
    }
    const dx = (x - pointerX) * rect.width / rect.height;
    const dy = y - pointerY;
    if (pipeline?.tracksMotion && hover && settings.playing && lastMove && (dx || dy)) {
      const dt = Math.max(12, Math.min(40, now - lastMove)) / 1000;
      const scale = 1 / Math.max(2.25 * dt, Math.hypot(dx, dy));
      gustX = dx * scale;
      gustY = dy * scale;
    }
    pointerX = x;
    pointerY = y;
    lastMove = now;
    hover = true;
  }

  function press(event: PointerEvent) {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, [role=button]"))) return;
    move(event);
    if (settings.playing) {
      pulse = 1;
      // A tap can begin and end between frames. Give image brushes an impulse
      // before release starts the decay so a short touch still produces a lens.
      if (options.image && event.pointerType === "touch") influence = 1;
    }
  }

  function leave() {
    hover = false;
    lastMove = 0;
  }

  function release(event: PointerEvent) {
    if (event.pointerType !== "mouse") leave();
  }

  function loseContext(event: Event) {
    event.preventDefault();
    stop();
    pipeline?.dispose();
    pipeline = null;
    onAvailability(false);
  }

  function restoreContext() {
    if (!gl) return;
    pipeline = makePipeline(gl, fragment, options, draw, onImageStatus);
    configure(settings);
    resize();
    onAvailability(Boolean(pipeline));
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  });
  intersectionObserver.observe(canvas);
  canvas.addEventListener("webglcontextlost", loseContext);
  canvas.addEventListener("webglcontextrestored", restoreContext);
  document.addEventListener("visibilitychange", schedule);
  target?.addEventListener("pointermove", move);
  target?.addEventListener("pointerenter", move);
  target?.addEventListener("pointerdown", press);
  target?.addEventListener("pointerup", release);
  target?.addEventListener("pointerleave", leave);
  target?.addEventListener("pointercancel", leave);
  configure(initial);
  resize();

  return {
    configure,
    dispose() {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", schedule);
      canvas.removeEventListener("webglcontextlost", loseContext);
      canvas.removeEventListener("webglcontextrestored", restoreContext);
      target?.removeEventListener("pointermove", move);
      target?.removeEventListener("pointerenter", move);
      target?.removeEventListener("pointerdown", press);
      target?.removeEventListener("pointerup", release);
      target?.removeEventListener("pointerleave", leave);
      target?.removeEventListener("pointercancel", leave);
      pipeline?.dispose();
      // Release detached gallery canvases promptly. Keep a connected canvas reusable
      // across effect reconfiguration and React StrictMode's setup/cleanup cycle.
      queueMicrotask(() => {
        if (!canvas.isConnected) gl.getExtension("WEBGL_lose_context")?.loseContext();
      });
    },
  };
}

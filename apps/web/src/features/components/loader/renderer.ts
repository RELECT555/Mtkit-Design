import { vertexShaderSource } from "./shaders/vertex";

type LoaderSettings = {
  uniforms: Record<string, number | number[]>;
  speed: number;
  paused: boolean;
};

function compileLoaderShader(gl: WebGL2RenderingContext, kind: number, source: string) {
  const shader = gl.createShader(kind);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

export function createLoaderRenderer(canvas: HTMLCanvasElement, fragment: string, initial: LoaderSettings, report: (ready: boolean) => void) {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
  if (!gl) return null;
  let settings = initial;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let locations: Record<string, WebGLUniformLocation | null> = {};
  let frame = 0;
  let elapsed = 0;
  let previous: number | undefined;
  let visible = false;
  let pixelRatio = 1;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");

  function release() {
    if (program) gl!.deleteProgram(program);
    if (buffer) gl!.deleteBuffer(buffer);
    program = buffer = null;
    locations = {};
  }

  function initialize() {
    const vertex = compileLoaderShader(gl!, gl!.VERTEX_SHADER, vertexShaderSource);
    const pixel = compileLoaderShader(gl!, gl!.FRAGMENT_SHADER, fragment);
    program = gl!.createProgram();
    if (program && vertex && pixel) {
      gl!.attachShader(program, vertex);
      gl!.attachShader(program, pixel);
      gl!.linkProgram(program);
    }
    if (vertex) gl!.deleteShader(vertex);
    if (pixel) gl!.deleteShader(pixel);
    if (!program || !gl!.getProgramParameter(program, gl!.LINK_STATUS)) { release(); return false; }
    buffer = gl!.createBuffer();
    if (!buffer) { release(); return false; }
    gl!.useProgram(program);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
    gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl!.STATIC_DRAW);
    const position = gl!.getAttribLocation(program, "a_position");
    gl!.enableVertexAttribArray(position);
    gl!.vertexAttribPointer(position, 2, gl!.FLOAT, false, 0, 0);
    // Fragments already return premultiplied alpha; a fullscreen triangle replaces every pixel.
    gl!.disable(gl!.BLEND);
    for (const name of ["u_time", "u_resolution", "u_pixelRatio", ...Object.keys(settings.uniforms)]) {
      locations[name] = gl!.getUniformLocation(program, name);
    }
    return true;
  }

  function draw() {
    if (!program) return;
    gl!.useProgram(program);
    gl!.uniform1f(locations.u_time, elapsed);
    gl!.uniform2f(locations.u_resolution, canvas.width, canvas.height);
    gl!.uniform1f(locations.u_pixelRatio, pixelRatio);
    for (const [name, value] of Object.entries(settings.uniforms)) {
      const location = locations[name];
      if (location == null) continue;
      if (typeof value === "number") gl!.uniform1f(location, value);
      else if (value.length === 2) gl!.uniform2fv(location, value);
      else if (value.length === 3) gl!.uniform3fv(location, value);
      else if (value.length === 4) gl!.uniform4fv(location, value);
    }
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = undefined;
  }

  function schedule() {
    if (!program || !visible || document.hidden || motion.matches || settings.paused || settings.speed <= 0) { stop(); return; }
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function tick(now: number) {
    frame = 0;
    if (previous !== undefined) elapsed += Math.min((now - previous) / 1000, 0.1) * settings.speed;
    previous = now;
    draw();
    schedule();
  }

  function resize() {
    if (!program) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    pixelRatio = Math.min(devicePixelRatio || 1, 2, 512 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    gl!.viewport(0, 0, canvas.width, canvas.height);
    draw();
  }

  function lost(event: Event) { event.preventDefault(); stop(); release(); report(false); }
  function restored() { report(initialize()); resize(); schedule(); }
  if (!initialize()) return null;
  const sizeObserver = new ResizeObserver(resize);
  const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); });
  sizeObserver.observe(canvas);
  visibilityObserver.observe(canvas);
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  document.addEventListener("visibilitychange", schedule);
  motion.addEventListener("change", schedule);
  resize();
  report(true);

  return {
    configure(next: LoaderSettings) { settings = next; draw(); schedule(); },
    dispose() {
      stop();
      sizeObserver.disconnect();
      visibilityObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      document.removeEventListener("visibilitychange", schedule);
      motion.removeEventListener("change", schedule);
      release();
      queueMicrotask(() => { if (!canvas.isConnected) gl!.getExtension("WEBGL_lose_context")?.loseContext(); });
    },
  };
}

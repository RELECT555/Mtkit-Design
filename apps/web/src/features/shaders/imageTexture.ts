export type ImageTextureStatus = "loading" | "ready" | "error";

// Self-authored demo art. The exported components need no external image or font.
function demoImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#100f19";
  ctx.fillRect(0, 0, 1200, 800);
  const glow = ctx.createRadialGradient(650, 370, 20, 600, 400, 580);
  glow.addColorStop(0, "#a998d9");
  glow.addColorStop(0.36, "#54416f");
  glow.addColorStop(1, "#100f19");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1200, 800);
  ctx.save();
  ctx.translate(600, 400);
  ctx.rotate(-0.32);
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 180 + i * 11, 100 + i * 6.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 193, 173, ${0.12 + (i % 5) * 0.08})`;
    ctx.lineWidth = i % 5 === 0 ? 3 : 1;
    ctx.stroke();
  }
  ctx.restore();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 156px sans-serif";
  ctx.fillStyle = "#fff3e9";
  ctx.fillText("MTKIT", 600, 395);
  ctx.font = "20px monospace";
  ctx.fillStyle = "#ffd8c9";
  ctx.fillText("DESIGN IN MOTION", 600, 505);
  return canvas;
}

export function createImageTexture(gl: WebGLRenderingContext, redraw: () => void, report: (status: ImageTextureStatus) => void) {
  const texture = gl.createTexture();
  let request = 0;
  let disposed = false;
  let current: string | undefined;
  let size: readonly [number, number] = [1200, 800];
  let image: HTMLImageElement | undefined;

  function upload(source: HTMLCanvasElement | HTMLImageElement) {
    // Bound decoded upload size even when a consumer passes a very large source.
    const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    if (!width || !height) throw new Error("Empty image");
    const limit = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
    const scale = Math.min(1, limit / Math.max(width, height));
    let pixels = source;
    if (scale < 1) {
      const resized = document.createElement("canvas");
      resized.width = Math.max(1, Math.round(width * scale));
      resized.height = Math.max(1, Math.round(height * scale));
      const context = resized.getContext("2d");
      if (!context) throw new Error("Image resize unavailable");
      context.drawImage(source, 0, 0, resized.width, resized.height);
      pixels = resized;
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    size = [width, height];
  }

  if (texture) upload(demoImage());
  return {
    get size() { return size; },
    configure(src = "") {
      if (src === current || disposed) return;
      current = src;
      const version = ++request;
      if (image) { image.onload = null; image.onerror = null; image.src = ""; }
      if (!texture) { report("error"); return; }
      if (!src) {
        upload(demoImage());
        report("ready");
        redraw();
        return;
      }
      report("loading");
      image = new Image();
      image.crossOrigin = "anonymous";
      const pending = image;
      pending.onload = () => {
        if (disposed || version !== request) return;
        try { upload(pending); report("ready"); redraw(); }
        catch { report("error"); }
      };
      pending.onerror = () => { if (!disposed && version === request) report("error"); };
      pending.src = src;
    },
    dispose() {
      disposed = true;
      request++;
      if (image) { image.onload = null; image.onerror = null; image.src = ""; }
      gl.deleteTexture(texture);
    },
  };
}

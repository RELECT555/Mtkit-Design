const pending = new Set<() => void>();
let frame = 0;
let timer = 0;

function schedule() {
  if (frame || timer || !pending.size) return;
  // Yield a paint before each compilation, including the first one. A separate
  // task avoids compiling every visible card in the same React effect flush.
  frame = requestAnimationFrame(() => {
    frame = 0;
    timer = window.setTimeout(() => {
      timer = 0;
      const next = pending.values().next().value;
      if (!next) return;
      pending.delete(next);
      try { next(); } finally { schedule(); }
    }, 0);
  });
}

export function scheduleShaderInitialization(initialize: () => void) {
  pending.add(initialize);
  schedule();
  return () => {
    pending.delete(initialize);
    if (pending.size) return;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    frame = timer = 0;
  };
}

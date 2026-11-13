import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import "./wheel-picker.css";

// Adapted from Wheel Picker by Dorian Baffier, Kokonut UI. See WHEEL-PICKER-LICENSE.txt.
const rowHeight = 36;
const rowAngle = 20;
const radius = rowHeight / 2 / Math.tan(Math.PI / 18);
const windowSize = Math.ceil(90 / rowAngle);
const velocityWindow = 80;
const motionQuery = "(prefers-reduced-motion: reduce)";

const wrap = (row: number, count: number) => ((row % count) + count) % count;
const twoDigits = (value: number) => String(value).padStart(2, "0");

function WheelColumn({ label, count, value, onChange }: {
  label: string;
  count: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const [center, setCenter] = useState(value);
  const positionRef = useRef(value);
  const centerRef = useRef(value);
  const column = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const scrollTimer = useRef(0);
  const drag = useRef<{ id: number; startY: number; start: number; moved: boolean; samples: { time: number; row: number }[] } | null>(null);

  function update(row: number) {
    positionRef.current = row;
    column.current?.style.setProperty("--wheel-rotation", `${row * rowAngle}deg`);
    const rounded = Math.round(row);
    if (rounded !== centerRef.current) {
      centerRef.current = rounded;
      setCenter(rounded);
    }
  }

  function stop() {
    window.cancelAnimationFrame(frame.current);
    window.clearTimeout(scrollTimer.current);
  }

  function snap(target: number, velocity = 0, immediate = false) {
    stop();
    const preference = window.matchMedia(motionQuery);
    function settle() {
      const next = wrap(target, count);
      update(next);
      onChange(next);
    }
    if (immediate || preference.matches || Math.abs(target - positionRef.current) < 0.001) {
      settle();
      return;
    }

    const flick = Math.abs(velocity) >= 2;
    const stiffness = flick ? 140 : 265;
    const damping = flick ? 24 : 25;
    let previous = performance.now();
    let row = positionRef.current;
    function tick(now: number) {
      if (preference.matches || (Math.abs(target - row) < 0.005 && Math.abs(velocity) < 0.05)) {
        settle();
        return;
      }
      const dt = Math.min((now - previous) / 1000, 1 / 30) / 4;
      previous = now;
      for (let step = 0; step < 4; step++) {
        velocity += (stiffness * (target - row) - damping * velocity) * dt;
        row += velocity * dt;
      }
      update(row);
      frame.current = window.requestAnimationFrame(tick);
    }
    frame.current = window.requestAnimationFrame(tick);
  }

  useEffect(() => {
    const element = column.current;
    if (!element) return;
    function scroll(event: WheelEvent) {
      if (event.ctrlKey || drag.current || !event.deltaY) return;
      event.preventDefault();
      stop();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rowHeight * 5 : 1);
      update(positionRef.current + pixels / rowHeight * 0.4);
      scrollTimer.current = window.setTimeout(() => snap(Math.round(positionRef.current)), 120);
    }
    element.addEventListener("wheel", scroll, { passive: false });
    return () => {
      element.removeEventListener("wheel", scroll);
      stop();
    };
  }, [count, onChange]);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (drag.current || event.button !== 0) return;
    stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = positionRef.current;
    drag.current = { id: event.pointerId, startY: event.clientY, start, moved: false, samples: [{ time: event.timeStamp, row: start }] };
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (active?.id !== event.pointerId) return;
    const distance = event.clientY - active.startY;
    if (!active.moved && Math.abs(distance) < 4) return;
    active.moved = true;
    const row = active.start - distance / rowHeight;
    active.samples.push({ time: event.timeStamp, row });
    active.samples = active.samples.filter(({ time }) => event.timeStamp - time <= velocityWindow);
    update(row);
  }

  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (active?.id !== event.pointerId) return;
    drag.current = null;
    if (event.type !== "pointerup") {
      snap(Math.round(positionRef.current));
      return;
    }
    if (!active.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const offset = event.clientY - rect.top - rect.height / 2;
      const angle = Math.asin(Math.max(-1, Math.min(1, offset / radius)));
      snap(Math.round(positionRef.current) + Math.round(angle * 180 / Math.PI / rowAngle));
      return;
    }

    const first = active.samples[0];
    const last = active.samples.at(-1);
    const elapsed = last && (last.time - first.time) / 1000;
    const speed = last && elapsed && event.timeStamp - last.time <= velocityWindow ? (last.row - first.row) / elapsed : 0;
    const velocity = Math.abs(speed) >= 2 && !window.matchMedia(motionQuery).matches
      ? Math.max(-45, Math.min(45, speed))
      : 0;
    snap(Math.round(positionRef.current + velocity * 0.32), velocity);
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (drag.current) return;
    const row = Math.round(positionRef.current);
    const targets: Record<string, number> = {
      ArrowUp: row + 1, ArrowDown: row - 1, PageUp: row + 5, PageDown: row - 5,
      Home: row - wrap(row, count), End: row - wrap(row, count) + count - 1,
    };
    const target = targets[event.key];
    if (typeof target !== "number") return;
    event.preventDefault();
    snap(target, 0, true);
  }

  const rows = Array.from({ length: windowSize * 2 + 1 }, (_, index) => center + index - windowSize);

  return (
    <div className="wheel-column" role="spinbutton" tabIndex={0} ref={column}
      style={{ "--wheel-radius": `${radius}px`, "--wheel-initial-rotation": `${value * rowAngle}deg` } as CSSProperties}
      aria-label={label} aria-valuemin={0} aria-valuemax={count - 1} aria-valuenow={value} aria-valuetext={twoDigits(value)}
      onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd}
      onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}>
      <div className="wheel-fade" aria-hidden="true">
        {[false, true].map((selected) => (
          <div className="wheel-depth" data-band={selected || undefined} key={String(selected)}>
            <div className="wheel-drum">
              {rows.map((row) => (
                <span className="wheel-row" key={row} style={{ transform: `rotateX(${-row * rowAngle}deg) translateZ(${radius}px)` }}>
                  {twoDigits(wrap(row, count))}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WheelPicker() {
  const [hours, setHours] = useState(9);
  const [minutes, setMinutes] = useState(30);
  const time = `${twoDigits(hours)}:${twoDigits(minutes)}`;

  return (
    <div className="wheel-demo">
      <div className="wheel-demo-label">
        <span>Время напоминания</span>
        <output aria-label="Выбранное время">{time}</output>
      </div>
      <div className="wheel-picker" role="group" aria-label="Время напоминания" style={{ "--wheel-row": `${rowHeight}px` } as CSSProperties}>
        <WheelColumn label="Часы" count={24} value={hours} onChange={setHours} />
        <span className="wheel-separator" aria-hidden="true">:</span>
        <WheelColumn label="Минуты" count={60} value={minutes} onChange={setMinutes} />
      </div>
    </div>
  );
}

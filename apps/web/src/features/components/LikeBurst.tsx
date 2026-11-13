import { Button } from "@mtkit/ui";
import { useEffect, useRef, useState } from "react";
import { likeHeartPath } from "./content";

type Spring = { position: number; velocity: number; target: number; stiffness: number; damping: number };

const dotAngles = Array.from({ length: 8 }, (_, index) => index * Math.PI / 4 + 0.2);
const burstDuration = 0.55;

function spring(position: number, stiffness: number, damping: number): Spring {
  return { position, velocity: 0, target: position, stiffness, damping };
}

function advance(value: Spring, dt: number) {
  value.velocity += (value.stiffness * (value.target - value.position) - value.damping * value.velocity) * dt;
  value.position += value.velocity * dt;
}

function settled(value: Spring) {
  return Math.abs(value.target - value.position) < 0.001 && Math.abs(value.velocity) < 0.01;
}

export function LikeBurst() {
  const [liked, setLiked] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const particles = useRef<HTMLSpanElement>(null);
  const frame = useRef<number>(0);
  const motion = useRef({ heart: spring(1, 520, 13), fill: spring(0, 300, 26), count: spring(0, 260, 20), elapsed: burstDuration });

  useEffect(() => () => window.cancelAnimationFrame(frame.current), []);

  function toggle(animate: boolean) {
    const next = !liked;
    setLiked(next);
    const element = button.current;
    const dots = particles.current;
    if (!element || !dots) return;

    window.cancelAnimationFrame(frame.current);
    const { heart, fill, count } = motion.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const value = Number(next);
    const reset = () => {
      motion.current = { heart: spring(1, 520, 13), fill: spring(value, 300, 26), count: spring(value, 260, 20), elapsed: burstDuration };
      element.style.removeProperty("--like-scale");
      element.style.removeProperty("--like-fill");
      element.style.removeProperty("--like-roll");
      dots.style.opacity = "0";
    };
    if (!animate || preference.matches) {
      reset();
      return;
    }

    heart.position = next ? 0.6 : 0.85;
    heart.velocity = next ? 9 : 3;
    fill.target = count.target = value;
    if (next) motion.current.elapsed = 0;

    const draw = () => {
      const scale = heart.position;
      element.style.setProperty("--like-scale", `${scale * (2 - Math.min(scale, 1.15))}, ${scale}`);
      element.style.setProperty("--like-fill", `${Math.max(0, Math.min(1, fill.position)) * 100}%`);
      element.style.setProperty("--like-roll", String(count.position));

      const progress = Math.min(motion.current.elapsed / burstDuration, 1);
      const distance = 1 - (1 - progress) ** 3;
      dots.style.opacity = String(1 - progress ** 2);
      dotAngles.forEach((angle, index) => {
        const dot = dots.children[index] as HTMLElement;
        const radius = 10 + distance * (22 + (index % 2) * 6);
        dot.style.transform = `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px) scale(${1 - 0.7 * progress})`;
      });
    };

    let previous = performance.now();
    function tick(now: number) {
      if (preference.matches) {
        reset();
        return;
      }
      const dt = Math.min((now - previous) / 1000, 1 / 30);
      previous = now;
      motion.current.elapsed += dt;
      for (let substep = 0; substep < 4; substep++) {
        advance(heart, dt / 4);
        advance(fill, dt / 4);
        advance(count, dt / 4);
      }
      if (motion.current.elapsed >= burstDuration && [heart, fill, count].every(settled)) {
        reset();
        return;
      }
      draw();
      frame.current = window.requestAnimationFrame(tick);
    }
    draw();
    frame.current = window.requestAnimationFrame(tick);
  }

  return (
    <>
      <Button ref={button} className="like-burst" type="button" variant="outline" aria-label="Нравится" aria-pressed={liked} onClick={(event) => toggle(event.detail > 0)}>
        <span className="like-burst-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d={likeHeartPath} />
          </svg>
          <span className="like-burst-particles" ref={particles}>
            {dotAngles.map((angle) => <span key={angle} />)}
          </span>
        </span>
        <span className="like-burst-count" aria-hidden="true"><span><span>0</span><span>1</span></span></span>
      </Button>
      <span className="sr-only" role="status">{liked ? "1 отметка «Нравится»" : "0 отметок «Нравится»"}</span>
    </>
  );
}

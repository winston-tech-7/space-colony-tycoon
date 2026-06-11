import { useEffect, useRef } from "react";

export function PlanetCanvas({ premium }: { premium?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let raf = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.35;

      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      grad.addColorStop(0, premium ? "#ffd27f" : "#7ec8ff");
      grad.addColorStop(0.5, premium ? "#ff6b35" : "#3a5bff");
      grad.addColorStop(1, "#1a1040");

      ctx.beginPath();
      ctx.arc(cx, cy + Math.sin(frame * 0.03) * 3, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.4, r * 0.35, frame * 0.01, 0, Math.PI * 2);
      ctx.stroke();

      frame += 1;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [premium]);

  return <canvas ref={ref} className="planet-canvas" width={280} height={140} />;
}

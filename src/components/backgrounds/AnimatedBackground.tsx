import React, { useRef, useEffect, useCallback } from "react";

interface AnimatedBackgroundProps {
  pattern: string;
  opacity: number;
}

const GRAY = {
  dim: "rgba(120,120,130,0.04)",
  soft: "rgba(160,160,170,0.08)",
  mid: "rgba(180,180,190,0.12)",
  bright: "rgba(210,210,220,0.18)",
  glow: "rgba(230,230,240,0.25)",
  white: "rgba(255,255,255,0.35)",
};

function useCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void, mouseRef?: React.MutableRefObject<{x:number;y:number}>, onClick?: (x: number, y: number) => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const onMouse = (e: MouseEvent) => {
      if (!mouseRef) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    if (mouseRef) window.addEventListener("mousemove", onMouse);

    const canvasClick = (e: MouseEvent) => {
      if (!onClick) return;
      const rect = canvas.getBoundingClientRect();
      onClick(e.clientX - rect.left, e.clientY - rect.top);
    };
    if (onClick) canvas.addEventListener("click", canvasClick);

    let running = true;
    const loop = (t: number) => {
      if (!running) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      draw(ctx, w, h, t);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      if (mouseRef) window.removeEventListener("mousemove", onMouse);
      if (onClick) canvas.removeEventListener("click", canvasClick);
    };
  }, [draw, mouseRef]);

  return canvasRef;
}

/* ─── 1. GLYPH RAIN ─── */
function GlyphRain() {
  const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
  const columnsRef = useRef<{ x: number; y: number; speed: number; char: string; bright: number }[]>([]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const colW = 18;
    const numCols = Math.ceil(w / colW);

    if (columnsRef.current.length !== numCols) {
      columnsRef.current = Array.from({ length: numCols }, (_, i) => ({
        x: i * colW,
        y: Math.random() * h,
        speed: 0.4 + Math.random() * 1.2,
        char: chars[Math.floor(Math.random() * chars.length)],
        bright: 0.3 + Math.random() * 0.7,
      }));
    }

    ctx.font = '13px monospace';
    ctx.textAlign = "center";

    for (const col of columnsRef.current) {
      col.y += col.speed;
      if (col.y > h + 20) {
        col.y = -20;
        col.char = chars[Math.floor(Math.random() * chars.length)];
        col.bright = 0.3 + Math.random() * 0.7;
      }

      if (Math.random() < 0.02) {
        col.char = chars[Math.floor(Math.random() * chars.length)];
      }

      const alpha = col.bright * 0.15;
      ctx.fillStyle = `rgba(200,200,210,${alpha})`;
      ctx.fillText(col.char, col.x, col.y);

      const headAlpha = col.bright * 0.4;
      ctx.fillStyle = `rgba(240,240,250,${headAlpha})`;
      ctx.fillText(col.char, col.x, col.y);

      for (let j = 1; j < 6; j++) {
        const trailAlpha = alpha * (1 - j / 6);
        ctx.fillStyle = `rgba(190,190,200,${trailAlpha})`;
        ctx.fillText(col.char, col.x, col.y - j * 14);
      }
    }
  }, []);

  const ref = useCanvas(draw);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

/* ─── 2. HEX FLOAT ─── */
function HexFloat() {
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const size = 32;
    const rows = Math.ceil(h / (size * 1.5)) + 2;
    const cols = Math.ceil(w / (size * Math.sqrt(3))) + 2;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;

    ctx.lineJoin = "round";

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const offset = row % 2 === 0 ? 0 : size * Math.sqrt(3) / 2;
        const cx = col * size * Math.sqrt(3) + offset;
        const cy = row * size * 1.5;

        const dist = Math.sqrt((cx - mx) ** 2 + (cy - my) ** 2);
        const proximity = Math.max(0, 1 - dist / 200);
        const floatY = Math.sin(t * 0.0008 + col * 0.5 + row * 0.3) * 3;
        const lift = proximity * 8;

        const alpha = 0.04 + proximity * 0.12;
        ctx.strokeStyle = `rgba(180,180,195,${alpha})`;
        ctx.lineWidth = 0.8;

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const hx = cx + size * 0.9 * Math.cos(angle);
          const hy = cy + floatY - lift + size * 0.9 * Math.sin(angle);
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();

        if (proximity > 0.3) {
          const fillAlpha = proximity * 0.06;
          ctx.fillStyle = `rgba(200,200,215,${fillAlpha})`;
          ctx.fill();
        }
      }
    }
  }, []);

  const ref = useCanvas(draw, mouseRef);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

/* ─── 3. BLAZE ─── */
function Blaze() {
  const sparksRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number; size: number }[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (sparksRef.current.length < 60) {
        sparksRef.current.push({
          x: Math.random() * window.innerWidth,
          y: window.innerHeight + 10,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -(1 + Math.random() * 2.5),
          life: 1,
          size: 1 + Math.random() * 2,
        });
      }
    }, 80);
    return () => clearInterval(interval);
  }, []);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    sparksRef.current = sparksRef.current.filter(s => s.life > 0.01 && s.y > -20);

    for (const s of sparksRef.current) {
      s.x += s.vx + Math.sin(t * 0.003 + s.x * 0.01) * 0.3;
      s.y += s.vy;
      s.vy *= 0.995;
      s.life *= 0.99;
      s.size *= 0.998;

      const alpha = s.life * 0.25;
      ctx.fillStyle = `rgba(200,200,210,${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();

      if (s.life > 0.5) {
        const glowAlpha = (s.life - 0.5) * 0.15;
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 4);
        glow.addColorStop(0, `rgba(220,220,235,${glowAlpha})`);
        glow.addColorStop(1, "rgba(190,190,205,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const waveY = h - 30;
    ctx.globalAlpha = 0.04;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, waveY + i * 15);
      for (let x = 0; x <= w; x += 4) {
        const y = waveY + i * 15 + Math.sin(x * 0.015 + t * 0.001 + i) * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = `rgba(180,180,195,${0.03 - i * 0.008})`;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, []);

  const ref = useCanvas(draw);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

const patternComponents: Record<string, React.FC> = {
  glyph: GlyphRain,
  hexfloat: HexFloat,
  blaze: Blaze,
};

export function AnimatedBackground({ pattern, opacity }: AnimatedBackgroundProps) {
  if (pattern === "none" || !patternComponents[pattern]) return null;

  const Pattern = patternComponents[pattern];
  const effectiveOpacity = opacity / 100;

  return (
    <div
      className="absolute inset-0 z-0 pointer-events-none"
      style={{ opacity: effectiveOpacity }}
    >
      <Pattern />
    </div>
  );
}

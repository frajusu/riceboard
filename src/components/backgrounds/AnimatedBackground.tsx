import React, { useMemo } from "react";

interface AnimatedBackgroundProps {
  pattern: string;
  opacity: number;
}

function Hexagons() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="animated-hexagon"
          style={{
            left: `${(i * 17) % 100}%`,
            top: `${(i * 23 + 5) % 100}%`,
            animationDelay: `${i * 0.8}s`,
            animationDuration: `${8 + (i % 3) * 2}s`,
          }}
        />
      ))}
    </div>
  );
}

function Waves() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="animated-wave animated-wave-1" />
      <div className="animated-wave animated-wave-2" />
      <div className="animated-wave animated-wave-3" />
    </div>
  );
}

function Circuit() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="circuit-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-violet-500/[0.06]" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#circuit-grid)" />
        {Array.from({ length: 8 }).map((_, i) => (
          <g key={i}>
            <circle
              cx={100 + (i * 90)}
              cy={80 + (i % 3) * 180}
              r="3"
              className="circuit-node"
              style={{ animationDelay: `${i * 0.5}s` }}
            />
            <line
              x1={100 + (i * 90)}
              y1={80 + (i % 3) * 180}
              x2={190 + (i * 90)}
              y2={80 + ((i + 1) % 3) * 180}
              stroke="currentColor"
              strokeWidth="0.5"
              className="circuit-line text-violet-500/[0.04]"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="animated-gradient-blob blob-1" />
      <div className="animated-gradient-blob blob-2" />
      <div className="animated-gradient-blob blob-3" />
    </div>
  );
}

function Particles() {
  const particles = useMemo(() => {
    const dots = Array.from({ length: 30 }).map((_, i) => ({
      cx: (i * 27 + 13) % 800,
      cy: (i * 41 + 7) % 600,
      r: 1 + (i % 3),
      delay: (i * 0.7) % 5,
      duration: 5 + (i % 5),
    }));
    const lines = Array.from({ length: 10 }).map((_, i) => {
      const x1 = (i * 73 + 20) % 800;
      const y1 = (i * 53 + 30) % 600;
      const offset = ((i * 37) % 200) - 100;
      return { x1, y1, x2: x1 + offset, y2: y1 + offset / 2, delay: i * 0.4 };
    });
    return { dots, lines };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        {particles.dots.map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            className="particle-dot"
            style={{
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
        {particles.lines.map((l, i) => (
          <line
            key={`l${i}`}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="currentColor"
            strokeWidth="0.3"
            className="particle-line text-violet-500/[0.03]"
            style={{ animationDelay: `${l.delay}s` }}
          />
        ))}
      </svg>
    </div>
  );
}

const patternComponents: Record<string, React.FC> = {
  hexagons: Hexagons,
  waves: Waves,
  circuit: Circuit,
  gradient: GradientMesh,
  particles: Particles,
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

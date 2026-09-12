"use client";

import { useId, useMemo } from "react";
import type { Direction, GridPos, PlayableAnimal, SnakeSkin } from "@/game/types";

const FACE: Record<Direction, string> = {
  up: "rotate(0deg)",
  right: "rotate(90deg)",
  down: "rotate(180deg)",
  left: "rotate(-90deg)",
};

const TUBE_STEPS = 3;

export function shade(hex: string, amount: number): string {
  const raw = hex.replace("#", "");
  const num = Number.parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + amount));
  const b = Math.min(255, Math.max(0, (num & 255) + amount));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export interface TubeBead {
  x: number;
  y: number;
  along: number;
  isHead: boolean;
  colorIndex: number;
}

export function tubeBeads(snake: GridPos[]): TubeBead[] {
  if (snake.length === 0) return [];
  const span = Math.max(snake.length - 1, 1);
  const beads: TubeBead[] = [];
  for (let i = 0; i < snake.length; i += 1) {
    const cur = snake[i]!;
    beads.push({
      x: cur.x,
      y: cur.y,
      along: i / span,
      isHead: i === 0,
      colorIndex: i,
    });
    const next = snake[i + 1];
    if (!next) continue;
    const dx = next.x - cur.x;
    const dy = next.y - cur.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
    for (let step = 1; step < TUBE_STEPS; step += 1) {
      const t = step / TUBE_STEPS;
      beads.push({
        x: cur.x + dx * t,
        y: cur.y + dy * t,
        along: (i + t) / span,
        isHead: false,
        colorIndex: i,
      });
    }
  }
  return beads;
}

function SnakeHeadSvg({
  colors,
  isSnake,
  emoji,
}: {
  colors: string[];
  isSnake: boolean;
  emoji: string;
}) {
  const gid = useId().replace(/:/g, "");
  const light = colors[0] ?? "#34d399";
  const mid = colors[1] ?? "#22d3ee";
  const dark = shade(colors[2] ?? "#059669", -28);
  if (!isSnake) {
    return (
      <div className="wf-creature-face" aria-hidden>
        <span>{emoji}</span>
      </div>
    );
  }
  return (
    <svg viewBox="0 0 64 84" className="wf-snake-head-svg" aria-hidden>
      <defs>
        <radialGradient id={`${gid}-skin`} cx="34%" cy="22%">
          <stop offset="0%" stopColor="#fffdf4" />
          <stop offset="22%" stopColor={light} />
          <stop offset="62%" stopColor={mid} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
        <linearGradient id={`${gid}-belly`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.0)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
        </linearGradient>
        <filter id={`${gid}-soft`} x="-35%" y="-25%" width="170%" height="170%">
          <feDropShadow dx="0" dy="3.4" stdDeviation="1.6" floodColor="rgba(46,16,70,0.42)" />
        </filter>
      </defs>
      <ellipse cx="32" cy="78" rx="11" ry="4.2" fill="rgba(46,16,70,0.28)" />
      <path
        d="M32 80 C20 78 14 64 14 50 C14 34 18 18 32 6 C46 18 50 34 50 50 C50 64 44 78 32 80Z"
        fill={`url(#${gid}-skin)`}
        filter={`url(#${gid}-soft)`}
      />
      <path
        d="M32 78 C24 74 20 62 20 50 C20 36 24 22 32 12 C40 22 44 36 44 50 C44 62 40 74 32 78Z"
        fill={`url(#${gid}-belly)`}
      />
      <ellipse cx="24" cy="20" rx="7" ry="3.2" fill="rgba(255,255,255,0.42)" />
      <path d="M32 8 C28 -2 22 -8 16 -6" stroke="#ef4444" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M32 8 C36 -2 44 -8 50 -5" stroke="#ef4444" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M32 9 L32 0" stroke="#f97316" strokeWidth="2.1" fill="none" strokeLinecap="round" />
      <ellipse cx="23" cy="38" rx="6.2" ry="7.4" fill="#fff" />
      <ellipse cx="41" cy="38" rx="6.2" ry="7.4" fill="#fff" />
      <circle cx="23.4" cy="39.4" r="3.1" fill="#1e1b4b" />
      <circle cx="41.4" cy="39.4" r="3.1" fill="#1e1b4b" />
      <circle cx="21.8" cy="37.4" r="1.05" fill="#fff" />
      <circle cx="39.8" cy="37.4" r="1.05" fill="#fff" />
      <path d="M24 56 Q32 62 40 56" stroke="#14532d" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Snake3D({
  snake,
  dir,
  cols,
  rows,
  skin,
  animal,
}: {
  snake: GridPos[];
  dir: Direction;
  cols: number;
  rows: number;
  skin: SnakeSkin;
  animal: PlayableAnimal;
}) {
  const isSnake = animal.id === "snake";
  const beads = useMemo(() => tubeBeads(snake), [snake]);
  return (
    <div className="wf-snake-layer" aria-hidden>
      {beads
        .map((bead, order) => ({ bead, order }))
        .reverse()
        .map(({ bead, order }) => {
          const color = skin.colors[bead.colorIndex % skin.colors.length] ?? skin.colors[0]!;
          const taper = 1 - bead.along * 0.34;
          return (
            <div
              key={`${bead.x}-${bead.y}-${order}`}
              className={`wf-snake-seg ${bead.isHead ? "wf-snake-head" : "wf-snake-bead"}`}
              data-testid={bead.isHead ? "snake-head" : undefined}
              style={{
                left: `${((bead.x + 0.5) / cols) * 100}%`,
                top: `${((bead.y + 0.5) / rows) * 100}%`,
                zIndex: bead.isHead ? 80 : Math.round(70 - bead.along * 40),
                background: bead.isHead
                  ? undefined
                  : `radial-gradient(circle at 30% 22%, #fffef8 0 10%, ${color} 34%, ${shade(color, -18)} 62%, ${shade(color, -52)} 100%)`,
                transform: bead.isHead
                  ? `translate(-50%, -50%) ${FACE[dir]}`
                  : `translate(-50%, -42%) scale(${taper})`,
              }}
            >
              {bead.isHead ? <SnakeHeadSvg colors={skin.colors} isSnake={isSnake} emoji={animal.emoji} /> : null}
            </div>
          );
        })}
    </div>
  );
}

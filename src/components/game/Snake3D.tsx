"use client";

import { useId } from "react";
import type { Direction, GridPos, PlayableAnimal, SnakeSkin } from "@/game/types";

const FACE: Record<Direction, string> = {
  up: "rotate(0deg)",
  right: "rotate(90deg)",
  down: "rotate(180deg)",
  left: "rotate(-90deg)",
};

function shade(hex: string, amount: number): string {
  const raw = hex.replace("#", "");
  const num = Number.parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + amount));
  const b = Math.min(255, Math.max(0, (num & 255) + amount));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
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
  const dark = shade(colors[2] ?? "#059669", -24);
  if (!isSnake) {
    return (
      <div className="wf-creature-face" aria-hidden>
        <span>{emoji}</span>
      </div>
    );
  }
  return (
    <svg viewBox="0 0 80 88" className="wf-snake-head-svg" aria-hidden>
      <defs>
        <radialGradient id={`${gid}-skin`} cx="32%" cy="28%">
          <stop offset="0%" stopColor="#fffef5" />
          <stop offset="28%" stopColor={light} />
          <stop offset="68%" stopColor={mid} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
        <filter id={`${gid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="2.2" floodColor="rgba(46,16,70,0.35)" />
        </filter>
      </defs>
      <path
        d="M40 82 C16 78 6 58 10 38 C14 16 26 6 40 4 C56 2 74 16 72 40 C70 62 62 80 40 82Z"
        fill={`url(#${gid}-skin)`}
        filter={`url(#${gid}-soft)`}
      />
      <ellipse cx="30" cy="18" rx="11" ry="6" fill="rgba(255,255,255,0.4)" />
      <path d="M36 6 C32 -6 24 -12 20 -10" stroke="#ef4444" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M36 6 C40 -6 50 -12 56 -8" stroke="#ef4444" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M38 8 L34 -2" stroke="#f97316" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <ellipse cx="26" cy="36" rx="9.5" ry="12" fill="#fff" />
      <ellipse cx="52" cy="36" rx="9.5" ry="12" fill="#fff" />
      <circle cx="27" cy="38" r="4.6" fill="#1e1b4b" />
      <circle cx="53" cy="38" r="4.6" fill="#1e1b4b" />
      <circle cx="24.8" cy="35.2" r="1.6" fill="#fff" />
      <circle cx="50.8" cy="35.2" r="1.6" fill="#fff" />
      <path d="M22 58 Q40 70 58 58" stroke="#166534" strokeWidth="2.6" fill="none" strokeLinecap="round" />
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
  return (
    <div className="wf-snake-layer" aria-hidden>
      {snake
        .map((pos, index) => ({ pos, index }))
        .reverse()
        .map(({ pos, index }) => {
          const color = skin.colors[index % skin.colors.length] ?? skin.colors[0]!;
          const isHead = index === 0;
          return (
            <div
              key={`${pos.x}-${pos.y}-${index}`}
              className={`wf-snake-seg ${isHead ? "wf-snake-head" : ""}`}
              data-testid={isHead ? "snake-head" : undefined}
              style={{
                left: `${((pos.x + 0.5) / cols) * 100}%`,
                top: `${((pos.y + 0.5) / rows) * 100}%`,
                zIndex: snake.length - index + (isHead ? 8 : 0),
                background: isHead
                  ? undefined
                  : `radial-gradient(circle at 32% 26%, #fffef8 0%, ${color} 38%, ${shade(color, -42)} 100%)`,
                transform: isHead
                  ? `translate(-50%, -50%) ${FACE[dir]}`
                  : "translate(-50%, -54%)",
              }}
            >
              {isHead ? <SnakeHeadSvg colors={skin.colors} isSnake={isSnake} emoji={animal.emoji} /> : null}
            </div>
          );
        })}
    </div>
  );
}

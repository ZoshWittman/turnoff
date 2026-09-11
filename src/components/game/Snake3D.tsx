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
        d="M40 78 C18 78 8 62 8 44 C8 22 20 10 40 10 C60 10 72 22 72 44 C72 62 62 78 40 78Z"
        fill={`url(#${gid}-skin)`}
        filter={`url(#${gid}-soft)`}
      />
      <ellipse cx="28" cy="22" rx="12" ry="7" fill="rgba(255,255,255,0.38)" />
      <path d="M40 12 C36 4 34 1 32 0" stroke="#ef4444" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M40 12 C44 4 48 -1 52 1" stroke="#ef4444" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M40 12 L40 3" stroke="#f97316" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="27" cy="38" rx="9" ry="11" fill="#fff" />
      <ellipse cx="53" cy="38" rx="9" ry="11" fill="#fff" />
      <circle cx="27" cy="40" r="4.4" fill="#1e1b4b" />
      <circle cx="53" cy="40" r="4.4" fill="#1e1b4b" />
      <circle cx="25.2" cy="37.4" r="1.5" fill="#fff" />
      <circle cx="51.2" cy="37.4" r="1.5" fill="#fff" />
      <path d="M24 58 Q40 68 56 58" stroke="#166534" strokeWidth="2.4" fill="none" strokeLinecap="round" />
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

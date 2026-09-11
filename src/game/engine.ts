import { FALLBACK_FACTS } from "@/data/fallbackFacts";
import type { Fact } from "@/types";
import {
  BOARD_COLS,
  BOARD_ROWS,
  TARGET_VALUES,
  levelForSessionReveals,
  tickMsForLevel,
} from "./rules";
import type { BoardState, BoardTarget, Direction, GridPos, TargetN } from "./types";

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const STEP: Record<Direction, GridPos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

export function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function posKey(pos: GridPos): string {
  return `${pos.x},${pos.y}`;
}

export function samePos(a: GridPos, b: GridPos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function wrapPos(pos: GridPos, cols = BOARD_COLS, rows = BOARD_ROWS): GridPos {
  return {
    x: ((pos.x % cols) + cols) % cols,
    y: ((pos.y % rows) + rows) % rows,
  };
}

export function queuedDirection(current: Direction, next: Direction): Direction {
  if (OPPOSITE[current] === next) return current;
  return next;
}

function occupiedSet(snake: GridPos[], extra: GridPos[] = []): Set<string> {
  const set = new Set<string>();
  for (const pos of snake) set.add(posKey(pos));
  for (const pos of extra) set.add(posKey(pos));
  return set;
}

function pickEmptyCell(
  rand: () => number,
  blocked: Set<string>,
  cols: number,
  rows: number,
): GridPos {
  const open: GridPos[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!blocked.has(`${x},${y}`)) open.push({ x, y });
    }
  }
  if (open.length === 0) return { x: 0, y: 0 };
  return open[Math.floor(rand() * open.length)]!;
}

function pickFact(rand: () => number, usedFactIds: string[]): Fact {
  const unused = FALLBACK_FACTS.filter((fact) => !usedFactIds.includes(fact.id));
  const pool = unused.length > 0 ? unused : FALLBACK_FACTS;
  return pool[Math.floor(rand() * pool.length)]!;
}

export function createBoard(seed = Date.now()): BoardState {
  const rand = mulberry32(seed >>> 0 || 1);
  const start: GridPos = { x: 4, y: 9 };
  const snake: GridPos[] = [
    start,
    { x: 4, y: 10 },
    { x: 3, y: 10 },
    { x: 2, y: 10 },
  ];
  const usedFactIds: string[] = [];
  const targets: BoardTarget[] = [];
  const blocked = occupiedSet(snake, [
    { x: 4, y: 8 },
    { x: 4, y: 7 },
  ]);

  const firstTwo: BoardTarget = {
    n: 2,
    pos: { x: 4, y: 7 },
    fact: pickFact(rand, usedFactIds),
  };
  usedFactIds.push(firstTwo.fact.id);
  targets.push(firstTwo);
  blocked.add(posKey(firstTwo.pos));

  for (const n of TARGET_VALUES) {
    if (n === 2) continue;
    const fact = pickFact(rand, usedFactIds);
    usedFactIds.push(fact.id);
    const pos = pickEmptyCell(rand, blocked, BOARD_COLS, BOARD_ROWS);
    blocked.add(posKey(pos));
    targets.push({ n, pos, fact });
  }

  return {
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    snake,
    dir: "up",
    pendingDir: "up",
    targets,
    level: 1,
    tickMs: tickMsForLevel(1),
    sessionReveals: 0,
    usedFactIds,
    rngSeed: Math.floor(rand() * 1_000_000_000),
  };
}

export function setPendingDir(board: BoardState, dir: Direction): BoardState {
  return { ...board, pendingDir: queuedDirection(board.dir, dir) };
}

export function targetAt(board: BoardState, pos: GridPos): BoardTarget | undefined {
  return board.targets.find((target) => samePos(target.pos, pos));
}

export function tickBoard(board: BoardState): { board: BoardState; landed?: BoardTarget } {
  const dir = queuedDirection(board.dir, board.pendingDir);
  const head = board.snake[0]!;
  const step = STEP[dir];
  const nextHead = wrapPos(
    { x: head.x + step.x, y: head.y + step.y },
    board.cols,
    board.rows,
  );
  const landed = targetAt(board, nextHead);
  const grew = Boolean(landed);
  const body = grew ? board.snake : board.snake.slice(0, -1);
  const snake = [nextHead, ...body].slice(0, 18);
  return {
    board: { ...board, snake, dir, pendingDir: dir },
    landed,
  };
}

export function replaceTarget(
  board: BoardState,
  n: TargetN,
  options?: { keepFactId?: string },
): BoardState {
  const rand = mulberry32((board.rngSeed + n * 997 + board.sessionReveals * 13) >>> 0 || 1);
  const blocked = occupiedSet(
    board.snake,
    board.targets.filter((target) => target.n !== n).map((target) => target.pos),
  );
  const used = board.usedFactIds.filter((id) => id !== options?.keepFactId);
  const fact = pickFact(rand, used);
  const pos = pickEmptyCell(rand, blocked, board.cols, board.rows);
  const targets = board.targets.map((target) =>
    target.n === n ? { n, pos, fact } : target,
  );
  return {
    ...board,
    targets,
    usedFactIds: [...used, fact.id].slice(-80),
    rngSeed: Math.floor(rand() * 1_000_000_000),
  };
}

export function completeReveal(board: BoardState, n: TargetN): BoardState {
  const sessionReveals = board.sessionReveals + 1;
  const level = levelForSessionReveals(sessionReveals);
  const next = replaceTarget(board, n);
  return {
    ...next,
    sessionReveals,
    level,
    tickMs: tickMsForLevel(level),
  };
}

export function missAndReplace(board: BoardState, n: TargetN): BoardState {
  return replaceTarget(board, n);
}

export function restartBoard(seed?: number): BoardState {
  return createBoard(seed ?? Date.now());
}

export function cellIndex(pos: GridPos, cols = BOARD_COLS): number {
  return pos.y * cols + pos.x;
}

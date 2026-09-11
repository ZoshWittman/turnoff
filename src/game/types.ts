import type { Fact, FactCategory, TriviaQuestion } from "@/types";

export type KidPlayMode = "explore" | "game";

export type Direction = "up" | "down" | "left" | "right";

export type GamePhase =
  | "howto"
  | "playing"
  | "paused"
  | "trivia"
  | "reveal"
  | "miss"
  | "levelup"
  | "unlock";

export type TargetN = 1 | 2 | 3 | 4 | 5;

export interface GridPos {
  x: number;
  y: number;
}

export interface BoardTarget {
  n: TargetN;
  pos: GridPos;
  fact: Fact;
}

export interface BoardState {
  cols: number;
  rows: number;
  snake: GridPos[];
  dir: Direction;
  pendingDir: Direction;
  targets: BoardTarget[];
  level: number;
  tickMs: number;
  sessionReveals: number;
  usedFactIds: string[];
  rngSeed: number;
}

export interface LandRound {
  target: BoardTarget;
  questions: TriviaQuestion[];
  timeLimitMs: number;
}

export interface LandRoundResult {
  success: boolean;
  reason: "complete" | "wrong" | "timeout" | "count-mismatch";
}

export interface SnakeSkin {
  id: string;
  label: string;
  emoji: string;
  unlockAt: number;
  colors: string[];
}

export interface PlayableAnimal {
  id: string;
  label: string;
  emoji: string;
  unlockAt: number;
  hint: string;
}

export interface EarnedSticker {
  factId: string;
  emoji: string;
  title: string;
  category: FactCategory;
  earnedAt: string;
}

export interface KidGameSave {
  stickers: Record<string, EarnedSticker>;
  selectedSkinId: string;
  selectedAnimalId: string;
  muted: boolean;
  seenHowTo: boolean;
  factsRevealed: number;
  playTimeMs: number;
  bestStickers: number;
  bestFactsRevealed: number;
  bestPlayTimeMs: number;
}

export interface LeaderboardEntry {
  kidId: string;
  name: string;
  avatar: string;
  stickers: number;
  factsRevealed: number;
  playTimeMs: number;
  updatedAt: string;
}

export interface AwardResult {
  save: KidGameSave;
  isNew: boolean;
  stickerCount: number;
  unlockedSkin?: SnakeSkin;
  unlockedAnimal?: PlayableAnimal;
}

export interface WonderFactGameTestApi {
  landOn: (n: TargetN) => void;
  snapshot: () => {
    phase: GamePhase;
    targets: Array<{ n: number; emoji: string; title: string }>;
    stickerCount: number;
    muted: boolean;
  };
}

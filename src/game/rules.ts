import type { Fact } from "@/types";
import { buildTriviaSetFromFact } from "@/services/trivia";
import type {
  AwardResult,
  KidGameSave,
  LandRound,
  LandRoundResult,
  PlayableAnimal,
  SnakeSkin,
  TargetN,
} from "./types";

export const BOARD_COLS = 9;
export const BOARD_ROWS = 11;
export const TARGET_VALUES: TargetN[] = [1, 2, 3, 4, 5];

export const TIME_LIMIT_MS: Record<TargetN, number> = {
  1: 10_000,
  2: 15_000,
  3: 25_000,
  4: 35_000,
  5: 45_000,
};

export const SNAKE_SKINS: SnakeSkin[] = [
  {
    id: "rainbow",
    label: "Rainbow",
    emoji: "🌈",
    unlockAt: 0,
    colors: ["#34d399", "#22d3ee", "#a78bfa", "#f472b6", "#fbbf24"],
  },
  {
    id: "lime",
    label: "Neon Lime",
    emoji: "🍋",
    unlockAt: 3,
    colors: ["#84cc16", "#bef264", "#65a30d", "#a3e635", "#4d7c0f"],
  },
  {
    id: "sunset",
    label: "Sunset",
    emoji: "🌅",
    unlockAt: 6,
    colors: ["#fb7185", "#fb923c", "#f59e0b", "#f472b6", "#ef4444"],
  },
  {
    id: "galaxy",
    label: "Galaxy",
    emoji: "🌌",
    unlockAt: 10,
    colors: ["#6366f1", "#8b5cf6", "#c084fc", "#22d3ee", "#1e1b4b"],
  },
  {
    id: "candy",
    label: "Candy Stripe",
    emoji: "🍬",
    unlockAt: 15,
    colors: ["#f472b6", "#fda4af", "#c4b5fd", "#67e8f9", "#f9a8d4"],
  },
  {
    id: "gold",
    label: "Gold Sparkle",
    emoji: "✨",
    unlockAt: 25,
    colors: ["#fbbf24", "#f59e0b", "#fde68a", "#f97316", "#eab308"],
  },
];

export const PLAYABLE_ANIMALS: PlayableAnimal[] = [
  { id: "snake", label: "Snake", emoji: "🐍", unlockAt: 0, hint: "Slither" },
  { id: "cockatiel", label: "Cockatiel", emoji: "🦜", unlockAt: 5, hint: "Flutter" },
  {
    id: "bird-of-paradise",
    label: "Bird of Paradise",
    emoji: "🦚",
    unlockAt: 12,
    hint: "Dance",
  },
  { id: "dog", label: "Dog", emoji: "🐕", unlockAt: 20, hint: "Zoom" },
  { id: "cat", label: "Cat", emoji: "🐱", unlockAt: 30, hint: "Pounce" },
];

export const LEVEL_REVEAL_STEPS = [0, 3, 6, 9, 12] as const;
export const LEVEL_TICK_MS = [480, 400, 340, 290, 250] as const;

export function clampTargetN(n: number): TargetN {
  const rounded = Math.round(n);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded as TargetN;
}

export function triviaCountForTarget(n: number): TargetN {
  return clampTargetN(n);
}

export function timeLimitMsForTarget(n: number): number {
  return TIME_LIMIT_MS[clampTargetN(n)];
}

export function timeLimitSecondsForTarget(n: number): number {
  return timeLimitMsForTarget(n) / 1000;
}

export function levelForSessionReveals(reveals: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_REVEAL_STEPS.length; i += 1) {
    if (reveals >= LEVEL_REVEAL_STEPS[i]!) level = i + 1;
  }
  return Math.min(level, LEVEL_TICK_MS.length);
}

export function tickMsForLevel(level: number): number {
  const index = Math.min(Math.max(level, 1), LEVEL_TICK_MS.length) - 1;
  return LEVEL_TICK_MS[index]!;
}

export function stickerCount(save: Pick<KidGameSave, "stickers">): number {
  return Object.keys(save.stickers).length;
}

export function unlockedSkins(count: number): SnakeSkin[] {
  return SNAKE_SKINS.filter((skin) => count >= skin.unlockAt);
}

export function unlockedAnimals(count: number): PlayableAnimal[] {
  return PLAYABLE_ANIMALS.filter((animal) => count >= animal.unlockAt);
}

export function isSkinUnlocked(skinId: string, count: number): boolean {
  const skin = SNAKE_SKINS.find((item) => item.id === skinId);
  return Boolean(skin && count >= skin.unlockAt);
}

export function isAnimalUnlocked(animalId: string, count: number): boolean {
  const animal = PLAYABLE_ANIMALS.find((item) => item.id === animalId);
  return Boolean(animal && count >= animal.unlockAt);
}

export function skinById(id: string): SnakeSkin {
  return SNAKE_SKINS.find((skin) => skin.id === id) ?? SNAKE_SKINS[0]!;
}

export function animalById(id: string): PlayableAnimal {
  return PLAYABLE_ANIMALS.find((animal) => animal.id === id) ?? PLAYABLE_ANIMALS[0]!;
}

export function emptyKidSave(): KidGameSave {
  return {
    stickers: {},
    selectedSkinId: "rainbow",
    selectedAnimalId: "snake",
    muted: false,
    seenHowTo: false,
    factsRevealed: 0,
    playTimeMs: 0,
    bestStickers: 0,
    bestFactsRevealed: 0,
    bestPlayTimeMs: 0,
  };
}

export function awardSticker(save: KidGameSave, fact: Fact, now = new Date()): AwardResult {
  const already = Boolean(save.stickers[fact.id]);
  const beforeCount = stickerCount(save);
  const stickers = already
    ? save.stickers
    : {
        ...save.stickers,
        [fact.id]: {
          factId: fact.id,
          emoji: fact.emoji,
          title: fact.title,
          category: fact.category,
          earnedAt: now.toISOString(),
        },
      };
  const count = Object.keys(stickers).length;
  const factsRevealed = already ? save.factsRevealed : save.factsRevealed + 1;
  const next: KidGameSave = {
    ...save,
    stickers,
    factsRevealed,
    bestStickers: Math.max(save.bestStickers, count),
    bestFactsRevealed: Math.max(save.bestFactsRevealed, factsRevealed),
  };

  const unlockedSkin = SNAKE_SKINS.find(
    (skin) => !already && beforeCount < skin.unlockAt && count >= skin.unlockAt,
  );
  const unlockedAnimal = PLAYABLE_ANIMALS.find(
    (animal) => !already && beforeCount < animal.unlockAt && count >= animal.unlockAt,
  );

  return {
    save: next,
    isNew: !already,
    stickerCount: count,
    unlockedSkin,
    unlockedAnimal,
  };
}

export function addPlayTime(save: KidGameSave, deltaMs: number): KidGameSave {
  const playTimeMs = Math.max(0, save.playTimeMs + Math.max(0, deltaMs));
  return {
    ...save,
    playTimeMs,
    bestPlayTimeMs: Math.max(save.bestPlayTimeMs, playTimeMs),
  };
}

export function buildLandRound(fact: Fact, n: number): LandRound {
  const targetN = clampTargetN(n);
  return {
    target: {
      n: targetN,
      pos: { x: 0, y: 0 },
      fact,
    },
    questions: buildTriviaSetFromFact(fact, targetN),
    timeLimitMs: timeLimitMsForTarget(targetN),
  };
}

export function evaluateLandRound(input: {
  targetN: number;
  questionCount: number;
  correctCount: number;
  timedOut: boolean;
  elapsedMs: number;
}): LandRoundResult {
  const n = clampTargetN(input.targetN);
  if (input.questionCount !== n) {
    return { success: false, reason: "count-mismatch" };
  }
  if (input.timedOut || input.elapsedMs > timeLimitMsForTarget(n)) {
    return { success: false, reason: "timeout" };
  }
  if (input.correctCount < n) {
    return { success: false, reason: "wrong" };
  }
  return { success: true, reason: "complete" };
}

export function kindMissMessage(reason: LandRoundResult["reason"]): string {
  if (reason === "timeout") return "Times up — let's try another number!";
  if (reason === "wrong") return "Almost! Steer to a new number for a fresh wonder.";
  return "Let's pick a new number and play again!";
}

export function formatPlayTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

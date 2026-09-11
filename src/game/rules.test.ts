import { describe, expect, it } from "vitest";
import { FALLBACK_FACTS } from "@/data/fallbackFacts";
import {
  addPlayTime,
  animalById,
  awardSticker,
  buildLandRound,
  emptyKidSave,
  evaluateLandRound,
  isAnimalUnlocked,
  isSkinUnlocked,
  kindMissMessage,
  levelForSessionReveals,
  PLAYABLE_ANIMALS,
  SNAKE_SKINS,
  stickerCount,
  tickMsForLevel,
  timeLimitMsForTarget,
  timeLimitSecondsForTarget,
  triviaCountForTarget,
  unlockedAnimals,
  unlockedSkins,
} from "./rules";
import { createBoard, missAndReplace, setPendingDir, tickBoard } from "./engine";

const octopus = FALLBACK_FACTS.find((fact) => fact.id === "fallback-octopus-hearts")!;

describe("time limits vs N", () => {
  it("gives kids more time for bigger numbers", () => {
    expect(timeLimitSecondsForTarget(1)).toBe(10);
    expect(timeLimitSecondsForTarget(2)).toBe(15);
    expect(timeLimitSecondsForTarget(3)).toBe(25);
    expect(timeLimitSecondsForTarget(4)).toBe(35);
    expect(timeLimitSecondsForTarget(5)).toBe(45);
    expect(timeLimitMsForTarget(2)).toBe(15_000);
    expect(timeLimitMsForTarget(99)).toBe(45_000);
    expect(timeLimitMsForTarget(0)).toBe(10_000);
  });
});

describe("trivia-on-land rules", () => {
  it("asks N offline questions for target N", () => {
    for (const n of [1, 2, 3, 4, 5] as const) {
      const round = buildLandRound(octopus, n);
      expect(round.questions).toHaveLength(n);
      expect(triviaCountForTarget(n)).toBe(n);
      expect(round.timeLimitMs).toBe(timeLimitMsForTarget(n));
      expect(round.questions.every((question) => question.source === "local")).toBe(true);
      expect(round.questions.every((question) => question.factId === octopus.id)).toBe(true);
      expect(new Set(round.questions.map((question) => question.id)).size).toBe(n);
    }
  });

  it("only reveals the fact when every question is correct in time", () => {
    expect(
      evaluateLandRound({
        targetN: 2,
        questionCount: 2,
        correctCount: 2,
        timedOut: false,
        elapsedMs: 8_000,
      }),
    ).toEqual({ success: true, reason: "complete" });

    expect(
      evaluateLandRound({
        targetN: 2,
        questionCount: 2,
        correctCount: 1,
        timedOut: false,
        elapsedMs: 4_000,
      }),
    ).toEqual({ success: false, reason: "wrong" });

    expect(
      evaluateLandRound({
        targetN: 2,
        questionCount: 2,
        correctCount: 2,
        timedOut: true,
        elapsedMs: 15_000,
      }),
    ).toEqual({ success: false, reason: "timeout" });

    expect(
      evaluateLandRound({
        targetN: 2,
        questionCount: 2,
        correctCount: 2,
        timedOut: false,
        elapsedMs: 15_001,
      }),
    ).toEqual({ success: false, reason: "timeout" });

    expect(
      evaluateLandRound({
        targetN: 3,
        questionCount: 2,
        correctCount: 2,
        timedOut: false,
        elapsedMs: 1_000,
      }),
    ).toEqual({ success: false, reason: "count-mismatch" });
  });

  it("uses a kind miss message instead of a harsh penalty", () => {
    expect(kindMissMessage("wrong")).toMatch(/fresh wonder/i);
    expect(kindMissMessage("timeout")).toMatch(/try another number/i);
  });
});

describe("sticker unlock thresholds", () => {
  it("unlocks skins and animals at the published sticker counts", () => {
    expect(SNAKE_SKINS.map((skin) => [skin.id, skin.unlockAt])).toEqual([
      ["rainbow", 0],
      ["lime", 3],
      ["sunset", 6],
      ["galaxy", 10],
      ["candy", 15],
      ["gold", 25],
    ]);
    expect(PLAYABLE_ANIMALS.map((animal) => [animal.id, animal.unlockAt])).toEqual([
      ["snake", 0],
      ["cockatiel", 5],
      ["bird-of-paradise", 12],
      ["dog", 20],
      ["cat", 30],
    ]);

    expect(unlockedSkins(0).map((skin) => skin.id)).toEqual(["rainbow"]);
    expect(unlockedSkins(3).map((skin) => skin.id)).toEqual(["rainbow", "lime"]);
    expect(unlockedAnimals(4).map((animal) => animal.id)).toEqual(["snake"]);
    expect(unlockedAnimals(5).some((animal) => animal.id === "cockatiel")).toBe(true);
    expect(isSkinUnlocked("gold", 24)).toBe(false);
    expect(isSkinUnlocked("gold", 25)).toBe(true);
    expect(isAnimalUnlocked("cat", 29)).toBe(false);
    expect(isAnimalUnlocked("cat", 30)).toBe(true);
    expect(animalById("missing").id).toBe("snake");
  });
});

describe("scoring", () => {
  it("awards unique stickers and tracks facts revealed", () => {
    const first = awardSticker(emptyKidSave(), octopus);
    expect(first.isNew).toBe(true);
    expect(first.stickerCount).toBe(1);
    expect(first.save.factsRevealed).toBe(1);
    expect(first.save.stickers[octopus.id]?.emoji).toBe("🐙");

    const again = awardSticker(first.save, octopus);
    expect(again.isNew).toBe(false);
    expect(again.stickerCount).toBe(1);
    expect(again.save.factsRevealed).toBe(1);

    let save = emptyKidSave();
    save = awardSticker(save, FALLBACK_FACTS[0]!).save;
    save = awardSticker(save, FALLBACK_FACTS[1]!).save;
    expect(stickerCount(save)).toBe(2);
    const locked = awardSticker(save, FALLBACK_FACTS[1]!);
    expect(locked.unlockedSkin).toBeUndefined();
    const unlock = awardSticker(save, FALLBACK_FACTS[2]!);
    expect(unlock.unlockedSkin?.id).toBe("lime");
    expect(unlock.stickerCount).toBe(3);
  });

  it("keeps a running play clock for the leaderboard", () => {
    const next = addPlayTime(emptyKidSave(), 12_500);
    expect(next.playTimeMs).toBe(12_500);
    expect(next.bestPlayTimeMs).toBe(12_500);
  });

  it("speeds up a little after more reveals", () => {
    expect(levelForSessionReveals(0)).toBe(1);
    expect(levelForSessionReveals(3)).toBe(2);
    expect(tickMsForLevel(2)).toBeLessThan(tickMsForLevel(1));
    expect(tickMsForLevel(5)).toBeLessThan(tickMsForLevel(3));
  });
});

describe("board landing", () => {
  it("pauses the run when the snake eats a numbered target", () => {
    const board = createBoard(7);
    const targetTwo = board.targets.find((target) => target.n === 2)!;
    expect(targetTwo.pos).toEqual({ x: 4, y: 7 });
    expect(board.snake[0]).toEqual({ x: 4, y: 9 });

    const first = tickBoard(board);
    expect(first.landed).toBeUndefined();
    const second = tickBoard(first.board);
    expect(second.landed?.n).toBe(2);
    expect(second.landed?.fact.id).toBe(targetTwo.fact.id);
  });

  it("swaps in a different fact after a miss so the snake can try another number", () => {
    const board = createBoard(11);
    const before = board.targets.find((target) => target.n === 2)!;
    const next = missAndReplace(setPendingDir(board, "up"), 2);
    const after = next.targets.find((target) => target.n === 2)!;
    expect(after.fact.id).not.toBe(before.fact.id);
    expect(next.snake[0]).toEqual(board.snake[0]);
  });
});

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Fact } from "@/types";
import { addPlayTime, animalById, awardSticker, emptyKidSave, skinById, stickerCount } from "@/game/rules";
import type { KidGameSave, LeaderboardEntry } from "@/game/types";

interface GamePersistState {
  byKid: Record<string, KidGameSave>;
  leaderboard: LeaderboardEntry[];
  kidMode: "explore" | "game";
  saveFor: (kidId: string) => KidGameSave;
  setMuted: (kidId: string, muted: boolean) => void;
  markHowToSeen: (kidId: string) => void;
  selectSkin: (kidId: string, skinId: string) => void;
  selectAnimal: (kidId: string, animalId: string) => void;
  collectSticker: (
    kidId: string,
    fact: Fact,
    profile: { name: string; avatar: string },
  ) => ReturnType<typeof awardSticker>;
  addPlayTime: (kidId: string, deltaMs: number, profile: { name: string; avatar: string }) => void;
  setKidMode: (mode: "explore" | "game") => void;
}

function upsertLeaderboard(
  list: LeaderboardEntry[],
  kidId: string,
  profile: { name: string; avatar: string },
  save: KidGameSave,
): LeaderboardEntry[] {
  const entry: LeaderboardEntry = {
    kidId,
    name: profile.name,
    avatar: profile.avatar,
    stickers: stickerCount(save),
    factsRevealed: save.factsRevealed,
    playTimeMs: save.playTimeMs,
    updatedAt: new Date().toISOString(),
  };
  const next = [entry, ...list.filter((item) => item.kidId !== kidId)];
  next.sort((a, b) => {
    if (b.stickers !== a.stickers) return b.stickers - a.stickers;
    if (b.factsRevealed !== a.factsRevealed) return b.factsRevealed - a.factsRevealed;
    return b.playTimeMs - a.playTimeMs;
  });
  return next.slice(0, 12);
}

export const useGameStore = create<GamePersistState>()(
  persist(
    (set, get) => ({
      byKid: {},
      leaderboard: [],
      kidMode: "explore",
      saveFor: (kidId) => get().byKid[kidId] ?? emptyKidSave(),
      setMuted: (kidId, muted) =>
        set((state) => ({
          byKid: {
            ...state.byKid,
            [kidId]: { ...(state.byKid[kidId] ?? emptyKidSave()), muted },
          },
        })),
      markHowToSeen: (kidId) =>
        set((state) => ({
          byKid: {
            ...state.byKid,
            [kidId]: { ...(state.byKid[kidId] ?? emptyKidSave()), seenHowTo: true },
          },
        })),
      selectSkin: (kidId, skinId) =>
        set((state) => {
          const save = state.byKid[kidId] ?? emptyKidSave();
          const count = stickerCount(save);
          if (skinById(skinId).unlockAt > count) return state;
          return {
            byKid: {
              ...state.byKid,
              [kidId]: { ...save, selectedSkinId: skinId },
            },
          };
        }),
      selectAnimal: (kidId, animalId) =>
        set((state) => {
          const save = state.byKid[kidId] ?? emptyKidSave();
          const count = stickerCount(save);
          if (animalById(animalId).unlockAt > count) return state;
          return {
            byKid: {
              ...state.byKid,
              [kidId]: { ...save, selectedAnimalId: animalId },
            },
          };
        }),
      collectSticker: (kidId, fact, profile) => {
        const save = get().byKid[kidId] ?? emptyKidSave();
        const result = awardSticker(save, fact);
        set((state) => ({
          byKid: { ...state.byKid, [kidId]: result.save },
          leaderboard: upsertLeaderboard(state.leaderboard, kidId, profile, result.save),
        }));
        return result;
      },
      addPlayTime: (kidId, deltaMs, profile) =>
        set((state) => {
          const save = addPlayTime(state.byKid[kidId] ?? emptyKidSave(), deltaMs);
          return {
            byKid: { ...state.byKid, [kidId]: save },
            leaderboard: upsertLeaderboard(state.leaderboard, kidId, profile, save),
          };
        }),
      setKidMode: (kidMode) => set({ kidMode }),
    }),
    {
      name: "wonderfact-game",
      partialize: (state) => ({
        byKid: state.byKid,
        leaderboard: state.leaderboard,
        kidMode: state.kidMode,
      }),
    },
  ),
);

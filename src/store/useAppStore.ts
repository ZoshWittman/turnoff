"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AiProviderId, BrowseCategory, Fact, FactCategory } from "@/types";
import { pickOfflineFact } from "@/services/aiProvider";

interface AppState {
  category: BrowseCategory;
  facts: Fact[];
  currentIndex: number;
  favorites: Fact[];
  recentTitles: string[];
  provider: AiProviderId;
  model: string;
  isGenerating: boolean;
  isSpeaking: boolean;
  warning: string | null;
  query: string;
  setCategory: (category: BrowseCategory) => void;
  setFacts: (facts: Fact[]) => void;
  addFact: (fact: Fact) => void;
  goTo: (index: number) => void;
  nextFact: () => void;
  prevFact: () => void;
  toggleFavorite: (fact: Fact) => void;
  isFavorite: (id: string) => boolean;
  setProvider: (provider: AiProviderId, model: string) => void;
  setGenerating: (value: boolean) => void;
  setSpeaking: (value: boolean) => void;
  setWarning: (warning: string | null) => void;
  setQuery: (query: string) => void;
  rememberTitle: (title: string) => void;
}

function seedFacts(category: FactCategory): Fact[] {
  return [pickOfflineFact(category), pickOfflineFact(category)].filter(
    (fact, index, list) => list.findIndex((item) => item.id === fact.id) === index,
  );
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      category: "animals",
      facts: seedFacts("animals"),
      currentIndex: 0,
      favorites: [],
      recentTitles: [],
      provider: "openai",
      model: "gpt-4o-mini",
      isGenerating: false,
      isSpeaking: false,
      warning: null,
      query: "",
      setCategory: (category) => {
        if (category === "favorites") {
          set({ category, currentIndex: 0 });
          return;
        }
        set({
          category,
          facts: seedFacts(category),
          currentIndex: 0,
          warning: null,
        });
      },
      setFacts: (facts) => set({ facts, currentIndex: 0 }),
      addFact: (fact) =>
        set((state) => ({
          facts: [fact, ...state.facts.filter((item) => item.id !== fact.id)],
          currentIndex: 0,
        })),
      goTo: (index) => {
        const { facts } = get();
        if (facts.length === 0) return;
        const next = (index + facts.length) % facts.length;
        set({ currentIndex: next });
      },
      nextFact: () => {
        const { category, facts, favorites, currentIndex } = get();
        const list = category === "favorites" ? favorites : facts;
        if (list.length === 0) return;
        set({ currentIndex: (currentIndex + 1) % list.length });
      },
      prevFact: () => {
        const { category, facts, favorites, currentIndex } = get();
        const list = category === "favorites" ? favorites : facts;
        if (list.length === 0) return;
        set({ currentIndex: (currentIndex - 1 + list.length) % list.length });
      },
      toggleFavorite: (fact) =>
        set((state) => {
          const exists = state.favorites.some((item) => item.id === fact.id);
          return {
            favorites: exists
              ? state.favorites.filter((item) => item.id !== fact.id)
              : [fact, ...state.favorites],
          };
        }),
      isFavorite: (id) => get().favorites.some((item) => item.id === id),
      setProvider: (provider, model) => set({ provider, model }),
      setGenerating: (isGenerating) => set({ isGenerating }),
      setSpeaking: (isSpeaking) => set({ isSpeaking }),
      setWarning: (warning) => set({ warning }),
      setQuery: (query) => set({ query }),
      rememberTitle: (title) =>
        set((state) => ({
          recentTitles: [title, ...state.recentTitles.filter((item) => item !== title)].slice(0, 12),
        })),
    }),
    {
      name: "wonderfact-app",
      partialize: (state) => ({
        favorites: state.favorites,
        provider: state.provider,
        model: state.model,
        category: state.category,
        recentTitles: state.recentTitles,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.category !== "favorites") {
          state.setFacts(seedFacts(state.category));
        }
      },
    },
  ),
);

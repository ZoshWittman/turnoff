"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Dices, Lock, Sparkles } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { FactCard } from "@/components/FactCard";
import { ParentModal } from "@/components/ParentModal";
import { CategoryBar } from "@/components/CategoryBar";
import { AskBar } from "@/components/AskBar";
import { AuthScreen } from "@/components/AuthScreen";
import { useAppStore } from "@/store/useAppStore";
import { pickOfflineFact, requestKidFact } from "@/services/aiProvider";
import { playStarSound, playSurpriseSound, haptic } from "@/services/sounds";
import { preloadVoices, speakFact, stopSpeaking } from "@/services/tts";
import { getSecretForProvider } from "@/services/secretVault";
import type { FactCategory } from "@/types";

function WonderFactApp() {
  const { user, ready, sessionSecrets } = useAuth();
  const {
    category,
    setCategory,
    facts,
    addFact,
    currentIndex,
    nextFact,
    prevFact,
    favorites,
    toggleFavorite,
    isFavorite,
    isGenerating,
    setGenerating,
    isSpeaking,
    setSpeaking,
    warning,
    setWarning,
    query,
    setQuery,
    provider,
    model,
    rememberTitle,
  } = useAppStore();
  const [parentOpen, setParentOpen] = useState(false);

  useEffect(() => {
    preloadVoices();
    return () => stopSpeaking();
  }, []);

  const visibleFacts = category === "favorites" ? favorites : facts;
  const current = visibleFacts[Math.min(currentIndex, Math.max(visibleFacts.length - 1, 0))];

  const dots = useMemo(
    () => visibleFacts.slice(0, 8).map((fact) => fact.id),
    [visibleFacts],
  );

  async function resolveApiKey(): Promise<string | undefined> {
    return getSecretForProvider(sessionSecrets, provider);
  }

  async function generate(options?: { surprise?: boolean; fromQuery?: boolean }) {
    const selected =
      category === "favorites" || options?.surprise
        ? (["animals", "space", "nature", "human-body", "food"][
            Math.floor(Math.random() * 5)
          ] as FactCategory)
        : category;
    const topic = options?.fromQuery ? query : options?.surprise ? "a surprising wow fact" : query;
    setGenerating(true);
    setWarning(null);
    haptic(18);
    if (options?.surprise) playSurpriseSound();
    try {
      const apiKey = await resolveApiKey();
      const result = await requestKidFact({
        category: selected,
        query: topic || undefined,
        recentTitles: useAppStore.getState().recentTitles,
        provider,
        model,
        apiKey,
      });
      addFact(result.fact);
      rememberTitle(result.fact.title);
      if (category === "favorites") setCategory(result.fact.category);
      if (result.warning) setWarning(result.warning);
    } catch {
      const fallback = pickOfflineFact(selected);
      addFact(fallback);
      setWarning("We used a built-in fact while the AI helper was busy.");
    } finally {
      setGenerating(false);
    }
  }

  function handleSpeak() {
    if (!current) return;
    if (isSpeaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speakFact(`${current.title}. ${current.fact}`, () => setSpeaking(false));
  }

  function handleFavorite() {
    if (!current) return;
    playStarSound();
    haptic([8, 30, 8]);
    toggleFavorite(current);
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-2xl font-bold text-violet-800">
        Warming up WonderFacts…
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="wf-shell">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pt-5">
        <div className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden>
            {user.avatar.emoji}
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-violet-600">Hi {user.displayName}!</p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl text-violet-950 sm:text-4xl">
              WonderFact Kids
            </h1>
          </div>
        </div>
        <button
          type="button"
          className="wf-icon-btn"
          onClick={() => setParentOpen(true)}
          aria-label="Parent settings"
        >
          <Lock />
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5">
        <CategoryBar value={category} onChange={setCategory} />

        <AskBar
          value={query}
          onChange={setQuery}
          disabled={isGenerating}
          onAsk={() => void generate({ fromQuery: true })}
        />

        <div className="flex flex-col items-center gap-4">
          {isGenerating && (
            <p className="flex items-center gap-2 text-lg font-bold text-violet-800">
              <Sparkles className="animate-spin" /> Mixing a brand-new fact…
            </p>
          )}
          {warning && (
            <p className="w-full max-w-xl rounded-2xl bg-amber-100 px-4 py-3 text-center font-bold text-amber-900">
              {warning}
            </p>
          )}
          <AnimatePresence mode="wait">
            {current ? (
              <FactCard
                fact={current}
                isFavorite={isFavorite(current.id)}
                isSpeaking={isSpeaking}
                onFavorite={handleFavorite}
                onSpeak={handleSpeak}
                onPrev={prevFact}
                onNext={nextFact}
              />
            ) : (
              <div className="rounded-[2rem] bg-white/80 p-8 text-center text-xl font-bold text-violet-800">
                {category === "favorites"
                  ? "No saved stars yet. Tap the star on a fact you love!"
                  : "Tap Surprise Me to find a fact!"}
              </div>
            )}
          </AnimatePresence>
          <div className="flex gap-2" aria-hidden>
            {dots.map((id, index) => (
              <span
                key={id}
                className={`h-3 w-3 rounded-full ${index === currentIndex ? "bg-violet-700" : "bg-violet-200"}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-auto grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="wf-btn bg-orange-300 text-violet-950"
            onClick={() => void generate({ surprise: true })}
            disabled={isGenerating}
          >
            <Dices size={28} /> Surprise Me!
          </button>
          <button
            type="button"
            className="wf-btn bg-lime-300 text-violet-950"
            onClick={nextFact}
          >
            Next fact →
          </button>
        </div>
      </main>

      {parentOpen ? <ParentModal onClose={() => setParentOpen(false)} /> : null}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WonderFactApp />
    </AuthProvider>
  );
}

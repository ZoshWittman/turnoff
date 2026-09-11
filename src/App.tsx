"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Dices, Lock, Sparkles } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { FactCard } from "@/components/FactCard";
import { TriviaPlay } from "@/components/TriviaPlay";
import { ParentModal } from "@/components/ParentModal";
import { CategoryBar } from "@/components/CategoryBar";
import { AskBar } from "@/components/AskBar";
import { AuthScreen } from "@/components/AuthScreen";
import { useAppStore } from "@/store/useAppStore";
import { pickOfflineFact, requestKidFact } from "@/services/aiProvider";
import {
  playCelebrateSound,
  playStarSound,
  playSurpriseSound,
  playTryAgainSound,
  haptic,
} from "@/services/sounds";
import {
  configureTts,
  getTtsStatus,
  isSpeechSupported,
  preloadVoices,
  speakFact,
  stopSpeaking,
  subscribeTtsStatus,
  type TtsStatus,
} from "@/services/tts";
import { buildTriviaFromFact, loadTriviaForFact, triviaSpeechText } from "@/services/trivia";
import { getSecretForProvider } from "@/services/secretVault";
import type { FactCategory, TriviaQuestion } from "@/types";

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
    ttsVoiceId,
  } = useAppStore();
  const [parentOpen, setParentOpen] = useState(false);
  const [trivia, setTrivia] = useState<TriviaQuestion | null>(null);
  const [revealedClues, setRevealedClues] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [triviaStatus, setTriviaStatus] = useState<"playing" | "correct" | "wrong">("playing");
  const [showAnswer, setShowAnswer] = useState(false);
  const [speechSupported] = useState(() => isSpeechSupported());
  const [ttsStatus, setTtsStatus] = useState<TtsStatus>(() => getTtsStatus());
  const triviaTouchedRef = useRef(false);
  const triviaFactIdRef = useRef<string | null>(null);

  useEffect(() => {
    configureTts({ preferredVoiceId: ttsVoiceId });
    preloadVoices();
    const unsub = subscribeTtsStatus(setTtsStatus);
    return () => {
      unsub();
      stopSpeaking();
    };
  }, [ttsVoiceId]);

  const visibleFacts = category === "favorites" ? favorites : facts;
  const current = visibleFacts[Math.min(currentIndex, Math.max(visibleFacts.length - 1, 0))];

  useEffect(() => {
    triviaTouchedRef.current = false;
    triviaFactIdRef.current = null;
    setTrivia(null);
    setRevealedClues(0);
    setWrongIds([]);
    setTriviaStatus("playing");
    setShowAnswer(false);
    stopSpeaking();
    setSpeaking(false);
  }, [current?.id, category, setSpeaking]);

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
    if (trivia) {
      speakFact(
        triviaSpeechText(trivia, {
          revealedClues,
          showAnswer,
          status: triviaStatus,
        }),
        () => setSpeaking(false),
      );
      return;
    }
    speakFact(`${current.title}. ${current.fact}`, () => setSpeaking(false));
  }

  function handleFavorite() {
    if (!current) return;
    playStarSound();
    haptic([8, 30, 8]);
    toggleFavorite(current);
  }

  async function openTrivia() {
    if (!current) return;
    const local = buildTriviaFromFact(current);
    triviaTouchedRef.current = false;
    triviaFactIdRef.current = current.id;
    setTrivia(local);
    setRevealedClues(0);
    setWrongIds([]);
    setTriviaStatus("playing");
    setShowAnswer(false);
    setSpeaking(true);
    speakFact(
      triviaSpeechText(local, { revealedClues: 0, status: "playing" }),
      () => setSpeaking(false),
    );

    const apiKey = await resolveApiKey();
    if (!apiKey) return;
    const maybeAi = await loadTriviaForFact(current, { apiKey, provider, model });
    if (maybeAi.source !== "ai") return;
    if (triviaFactIdRef.current !== current.id || triviaTouchedRef.current) return;
    setTrivia(maybeAi);
    setSpeaking(true);
    speakFact(
      triviaSpeechText(maybeAi, { revealedClues: 0, status: "playing" }),
      () => setSpeaking(false),
    );
  }

  function handleTriviaChoice(id: string) {
    if (!trivia || showAnswer || triviaStatus === "correct") return;
    const choice = trivia.choices.find((item) => item.id === id);
    if (!choice || wrongIds.includes(id)) return;
    triviaTouchedRef.current = true;
    if (choice.isCorrect) {
      setTriviaStatus("correct");
      setShowAnswer(true);
      playCelebrateSound();
      haptic([12, 40, 12]);
      setSpeaking(true);
      speakFact(
        triviaSpeechText(trivia, {
          revealedClues,
          showAnswer: true,
          status: "correct",
        }),
        () => setSpeaking(false),
      );
      return;
    }
    const nextClues = Math.min(revealedClues + 1, trivia.clues.length);
    setTriviaStatus("wrong");
    setWrongIds((prev) => [...prev, id]);
    setRevealedClues(nextClues);
    playTryAgainSound();
    haptic(16);
    setSpeaking(true);
    speakFact(
      triviaSpeechText(trivia, {
        revealedClues: nextClues,
        status: "wrong",
      }),
      () => setSpeaking(false),
    );
  }

  function handleTriviaClue() {
    if (!trivia) return;
    triviaTouchedRef.current = true;
    if (revealedClues < trivia.clues.length) {
      const next = revealedClues + 1;
      const clue = trivia.clues[revealedClues];
      setRevealedClues(next);
      setSpeaking(true);
      speakFact(clue ?? trivia.prompt, () => setSpeaking(false));
      return;
    }
    setShowAnswer(true);
    setSpeaking(true);
    speakFact(`The answer is: ${trivia.answer}`, () => setSpeaking(false));
  }

  function closeTrivia() {
    triviaTouchedRef.current = false;
    triviaFactIdRef.current = null;
    setTrivia(null);
    setRevealedClues(0);
    setWrongIds([]);
    setTriviaStatus("playing");
    setShowAnswer(false);
    stopSpeaking();
    setSpeaking(false);
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

        {!trivia ? (
          <AskBar
            value={query}
            onChange={setQuery}
            disabled={isGenerating}
            onAsk={() => void generate({ fromQuery: true })}
          />
        ) : (
          <p className="text-center text-lg font-extrabold text-violet-800">Quiz time — big buttons, one right answer!</p>
        )}

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
            {current && trivia ? (
              <TriviaPlay
                fact={current}
                trivia={trivia}
                revealedClues={revealedClues}
                wrongIds={wrongIds}
                status={triviaStatus}
                showAnswer={showAnswer}
                isSpeaking={isSpeaking}
                speechSupported={speechSupported}
                voiceName={ttsStatus.voiceName}
                voiceLoading={ttsStatus.loading}
                voiceProgress={ttsStatus.progress}
                voiceEngine={ttsStatus.engine}
                onChoice={handleTriviaChoice}
                onClue={handleTriviaClue}
                onSpeak={handleSpeak}
                onBack={closeTrivia}
              />
            ) : current ? (
              <FactCard
                fact={current}
                isFavorite={isFavorite(current.id)}
                isSpeaking={isSpeaking}
                speechSupported={speechSupported}
                voiceName={ttsStatus.voiceName}
                voiceLoading={ttsStatus.loading}
                voiceProgress={ttsStatus.progress}
                voiceEngine={ttsStatus.engine}
                onFavorite={handleFavorite}
                onSpeak={handleSpeak}
                onTrivia={() => void openTrivia()}
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

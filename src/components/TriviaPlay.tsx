"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, PartyPopper, Undo2, Volume2, VolumeX } from "lucide-react";
import type { Fact, TriviaQuestion } from "@/types";
import { CATEGORY_META } from "@/types";
import { VoiceBadge } from "@/components/VoiceBadge";

const CHOICE_COLORS = [
  "bg-sky-300 hover:bg-sky-200",
  "bg-amber-300 hover:bg-amber-200",
  "bg-lime-300 hover:bg-lime-200",
  "bg-fuchsia-300 hover:bg-fuchsia-200",
];

interface TriviaPlayProps {
  fact: Fact;
  trivia: TriviaQuestion;
  revealedClues: number;
  wrongIds: string[];
  status: "playing" | "correct" | "wrong";
  showAnswer: boolean;
  isSpeaking: boolean;
  speechSupported: boolean;
  voiceName?: string;
  voiceLoading?: boolean;
  voiceProgress?: number;
  voiceEngine?: "neural" | "browser" | "none";
  onChoice: (id: string) => void;
  onClue: () => void;
  onSpeak: () => void;
  onBack: () => void;
}

export function TriviaPlay({
  fact,
  trivia,
  revealedClues,
  wrongIds,
  status,
  showAnswer,
  isSpeaking,
  speechSupported,
  voiceName,
  voiceLoading,
  voiceProgress,
  voiceEngine,
  onChoice,
  onClue,
  onSpeak,
  onBack,
}: TriviaPlayProps) {
  const solved = status === "correct" || showAnswer;
  const visibleClues = trivia.clues.slice(0, revealedClues);
  const nextClue = trivia.clues[revealedClues];

  return (
    <motion.article
      key={`trivia-${trivia.id}`}
      initial={{ opacity: 0, scale: 0.94, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -12 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className="relative mx-auto w-full max-w-xl"
      aria-label="Trivia quiz"
    >
      <div
        className="rounded-[2.2rem] border-4 border-white/80 p-6 shadow-[0_18px_0_rgba(80,40,90,0.12)] sm:p-8"
        style={{
          background: `linear-gradient(165deg, #fff 0%, ${fact.themeColor} 140%)`,
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-violet-800 shadow-sm">
            {CATEGORY_META[fact.category].emoji} Trivia Time
          </span>
          <span className="text-5xl" aria-hidden>
            {fact.emoji}
          </span>
        </div>

        <h2 className="text-center font-[family-name:var(--font-display)] text-2xl font-bold leading-snug text-violet-950 sm:text-3xl">
          {trivia.prompt}
        </h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {trivia.choices.map((choice, index) => {
            const isWrong = wrongIds.includes(choice.id);
            const isWin = solved && choice.isCorrect;
            return (
              <motion.button
                key={choice.id}
                type="button"
                disabled={solved || isWrong}
                onClick={() => onChoice(choice.id)}
                whileTap={solved || isWrong ? undefined : { scale: 0.97 }}
                animate={isWrong ? { x: [0, -8, 8, -6, 6, 0] } : isWin ? { scale: [1, 1.06, 1] } : {}}
                className={`wf-btn min-h-[4.2rem] text-left text-lg leading-snug text-violet-950 ${
                  isWin
                    ? "bg-emerald-300"
                    : isWrong
                      ? "bg-rose-200 opacity-70"
                      : CHOICE_COLORS[index % CHOICE_COLORS.length]
                }`}
              >
                {choice.label}
              </motion.button>
            );
          })}
        </div>

        <div className="mt-4 min-h-[3rem] space-y-2" aria-live="polite">
          {visibleClues.map((clue) => (
            <p
              key={clue}
              className="rounded-2xl bg-white/85 px-4 py-2 text-center text-lg font-bold text-violet-900"
            >
              {clue}
            </p>
          ))}
          {status === "wrong" && !solved && (
            <p className="text-center text-lg font-extrabold text-violet-800">
              Not that one. Try another clue!
            </p>
          )}
          {status === "correct" && (
            <motion.p
              className="wf-celebrate text-center text-2xl font-extrabold text-emerald-800"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              {trivia.celebration}
            </motion.p>
          )}
          {solved && (
            <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-center text-lg font-bold text-emerald-950">
              {trivia.answer}
            </p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClue}
            disabled={!nextClue && solved}
            className="wf-btn bg-yellow-300 text-violet-950"
          >
            <Lightbulb size={26} />
            {nextClue ? `Clue ${revealedClues + 1}!` : showAnswer ? "All clues shown" : "Show the answer"}
          </button>
          {speechSupported ? (
            <div className="grid gap-2">
              <button type="button" onClick={onSpeak} className="wf-btn bg-sky-400 text-violet-950">
                {isSpeaking ? <VolumeX size={26} /> : <Volume2 size={26} />}
                {isSpeaking ? "Shh!" : "Read To Me!"}
              </button>
              {voiceName ? (
                <VoiceBadge
                  name={voiceName}
                  loading={voiceLoading}
                  progress={voiceProgress}
                  engine={voiceEngine}
                />
              ) : null}
            </div>
          ) : (
            <p className="flex items-center justify-center rounded-2xl bg-white/80 px-3 py-2 text-center font-bold text-violet-700">
              Ask a grown-up to read this quiz aloud.
            </p>
          )}
        </div>

        <button type="button" onClick={onBack} className="wf-btn mt-3 w-full bg-white text-violet-950">
          {solved ? <PartyPopper size={24} /> : <Undo2 size={24} />}
          {solved ? "Back to the fact" : "Back to the fact"}
        </button>
      </div>

      <AnimatePresence>
        {status === "correct" ? (
          <motion.div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.2rem]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden
          >
            {["⭐", "🎉", "✨", "🌟", "🎊", "💛"].map((emoji, index) => (
              <motion.span
                key={emoji}
                className="absolute text-4xl"
                initial={{ y: 180, x: 40 + index * 48, opacity: 0, rotate: 0 }}
                animate={{ y: -20, opacity: [0, 1, 1, 0], rotate: 20 * (index % 2 === 0 ? 1 : -1) }}
                transition={{ duration: 1.4, delay: index * 0.08 }}
              >
                {emoji}
              </motion.span>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

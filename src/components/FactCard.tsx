"use client";

import { motion, type PanInfo } from "framer-motion";
import { Puzzle, Star, Volume2, VolumeX } from "lucide-react";
import type { Fact } from "@/types";
import { CATEGORY_META } from "@/types";
import { VoiceBadge } from "@/components/VoiceBadge";

interface FactCardProps {
  fact: Fact;
  isFavorite: boolean;
  isSpeaking: boolean;
  speechSupported: boolean;
  voiceName?: string;
  voiceLoading?: boolean;
  voiceEngine?: "neural" | "browser" | "none";
  onFavorite: () => void;
  onSpeak: () => void;
  onTrivia: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function FactCard({
  fact,
  isFavorite,
  isSpeaking,
  speechSupported,
  voiceName,
  voiceLoading,
  voiceEngine,
  onFavorite,
  onSpeak,
  onTrivia,
  onPrev,
  onNext,
}: FactCardProps) {
  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -80 || info.velocity.x < -500) onNext();
    if (info.offset.x > 80 || info.velocity.x > 500) onPrev();
  }

  return (
    <motion.article
      key={fact.id}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.18}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className="relative mx-auto w-full max-w-xl cursor-grab active:cursor-grabbing"
      aria-label={`${fact.title} fact card`}
    >
      <div
        className="rounded-[2.2rem] border-4 border-white/80 p-6 shadow-[0_18px_0_rgba(80,40,90,0.12)] sm:p-8"
        style={{
          background: `linear-gradient(165deg, #fff 0%, ${fact.themeColor} 140%)`,
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-violet-800 shadow-sm">
            {CATEGORY_META[fact.category].emoji} {CATEGORY_META[fact.category].label}
          </span>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">
            {fact.source === "ai" ? "Fresh" : "Library"}
          </span>
        </div>

        <motion.div
          className="mb-4 text-center text-7xl sm:text-8xl"
          animate={{ rotate: [0, -8, 8, 0], y: [0, -6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6 }}
          aria-hidden
        >
          {fact.emoji}
        </motion.div>

        <h2 className="text-center font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-violet-950 sm:text-4xl">
          {fact.title}
        </h2>
        <p className="mt-4 text-center text-xl leading-relaxed text-violet-900 sm:text-2xl">
          {fact.fact}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={onTrivia}
            className="wf-btn bg-fuchsia-400 text-violet-950 hover:bg-fuchsia-300"
          >
            <Puzzle size={28} />
            Trivia!
          </button>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {speechSupported ? (
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={onSpeak}
                  className="wf-btn bg-sky-400 text-violet-950 hover:bg-sky-300"
                >
                  {isSpeaking ? <VolumeX size={28} /> : <Volume2 size={28} />}
                  {isSpeaking ? "Shh!" : voiceLoading ? "Almost ready…" : "Read To Me!"}
                </button>
                {voiceName ? (
                  <VoiceBadge name={voiceName} loading={voiceLoading} engine={voiceEngine} />
                ) : null}
              </div>
            ) : (
              <p className="flex items-center justify-center rounded-2xl bg-white/80 px-3 py-3 text-center font-bold text-violet-700">
                Ask a grown-up to read this fact aloud.
              </p>
            )}
            <button
              type="button"
              onClick={onFavorite}
              className={`wf-btn ${isFavorite ? "bg-amber-300" : "bg-white"} text-violet-950`}
              aria-pressed={isFavorite}
            >
              <Star size={28} fill={isFavorite ? "#f59e0b" : "transparent"} />
              {isFavorite ? "Saved!" : "Save to Favorites"}
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

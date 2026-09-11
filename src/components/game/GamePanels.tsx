"use client";

import { CATEGORY_META } from "@/types";
import { formatPlayTime, PLAYABLE_ANIMALS, SNAKE_SKINS, stickerCount, unlockedAnimals, unlockedSkins } from "@/game/rules";
import type { KidGameSave, LeaderboardEntry, PlayableAnimal, SnakeSkin } from "@/game/types";

export function HowToOverlay({ onStart }: { onStart: () => void }) {
  return (
    <div className="wf-game-modal" data-testid="howto-overlay" role="dialog" aria-label="How to play">
      <div className="wf-game-card">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-violet-950">How to play</h2>
        <ul className="mt-4 grid gap-3 text-left text-lg font-extrabold text-violet-900">
          <li className="rounded-2xl bg-lime-100 px-4 py-3">➡️ Steer the animal</li>
          <li className="rounded-2xl bg-amber-100 px-4 py-3">1️⃣ Eat a number + sticker</li>
          <li className="rounded-2xl bg-sky-100 px-4 py-3">❓ Answer the quiz</li>
          <li className="rounded-2xl bg-fuchsia-100 px-4 py-3">⭐ Keep the sticker!</li>
        </ul>
        <button type="button" className="wf-btn mt-5 w-full bg-lime-300 text-violet-950" onClick={onStart}>
          Let&apos;s go!
        </button>
      </div>
    </div>
  );
}

export function PauseOverlay({
  onResume,
  onRestart,
  onHowTo,
}: {
  onResume: () => void;
  onRestart: () => void;
  onHowTo: () => void;
}) {
  return (
    <div className="wf-game-modal" data-testid="pause-overlay" role="dialog" aria-label="Paused">
      <div className="wf-game-card">
        <p className="text-6xl" aria-hidden>
          ⏸️
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-violet-950">Pause</h2>
        <div className="mt-4 grid gap-3">
          <button type="button" className="wf-btn bg-lime-300 text-violet-950" onClick={onResume}>
            Play
          </button>
          <button type="button" className="wf-btn bg-amber-200 text-violet-950" onClick={onRestart}>
            Restart
          </button>
          <button type="button" className="wf-btn bg-white text-violet-950" onClick={onHowTo}>
            How to
          </button>
        </div>
      </div>
    </div>
  );
}

export function MissOverlay({
  message,
  onContinue,
}: {
  message: string;
  onContinue: () => void;
}) {
  return (
    <div className="wf-game-modal" data-testid="miss-overlay" role="dialog" aria-label="Try another number">
      <div className="wf-game-card">
        <p className="text-6xl" aria-hidden>
          💛
        </p>
        <p className="mt-2 text-2xl font-extrabold text-violet-900">{message}</p>
        <button
          type="button"
          data-testid="miss-continue"
          className="wf-btn mt-5 w-full bg-sky-300 text-violet-950"
          onClick={onContinue}
        >
          Steer again
        </button>
      </div>
    </div>
  );
}

export function AlbumPanel({
  save,
  onClose,
}: {
  save: KidGameSave;
  onClose: () => void;
}) {
  const stickers = Object.values(save.stickers);
  return (
    <div className="wf-game-modal" data-testid="album-panel" role="dialog" aria-label="Sticker album">
      <div className="wf-game-card max-h-[85vh] overflow-y-auto">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-violet-950">Sticker album</h2>
        <p className="mt-1 font-bold text-violet-700">{stickers.length} collected</p>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {stickers.length === 0 ? (
            <p className="col-span-full rounded-2xl bg-white/80 px-3 py-6 text-lg font-bold text-violet-800">
              Eat numbers to fill this book!
            </p>
          ) : (
            stickers.map((sticker) => (
              <div
                key={sticker.factId}
                className="rounded-2xl bg-white p-3 text-center shadow-sm"
                title={sticker.title}
              >
                <p className="text-4xl">{sticker.emoji}</p>
                <p className="mt-1 line-clamp-2 text-xs font-extrabold text-violet-900">{sticker.title}</p>
                <p className="text-[10px] font-bold text-violet-500">
                  {CATEGORY_META[sticker.category].emoji}
                </p>
              </div>
            ))
          )}
        </div>
        <button type="button" className="wf-btn mt-5 w-full bg-white text-violet-950" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export function LeaderboardPanel({
  entries,
  kidId,
  onClose,
}: {
  entries: LeaderboardEntry[];
  kidId: string;
  onClose: () => void;
}) {
  return (
    <div className="wf-game-modal" data-testid="leaderboard-panel" role="dialog" aria-label="Leaderboard">
      <div className="wf-game-card max-h-[85vh] overflow-y-auto">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-violet-950">Stars board</h2>
        <p className="mt-1 font-bold text-violet-700">Stickers · facts · time</p>
        <ol className="mt-4 grid gap-2">
          {entries.length === 0 ? (
            <li className="rounded-2xl bg-white/80 px-3 py-4 font-bold text-violet-800">
              Play a round to add your name!
            </li>
          ) : (
            entries.map((entry, index) => (
              <li
                key={entry.kidId}
                data-testid={entry.kidId === kidId ? "leaderboard-self" : undefined}
                className={`flex items-center justify-between rounded-2xl px-3 py-3 ${
                  entry.kidId === kidId ? "bg-lime-200" : "bg-white/90"
                }`}
              >
                <span className="flex items-center gap-2 text-lg font-extrabold text-violet-950">
                  <span>{index + 1}.</span>
                  <span>{entry.avatar}</span>
                  {entry.name}
                </span>
                <span className="text-right text-sm font-bold text-violet-800">
                  {entry.stickers} ⭐ · {entry.factsRevealed} 📘
                  <br />
                  {formatPlayTime(entry.playTimeMs)}
                </span>
              </li>
            ))
          )}
        </ol>
        <button type="button" className="wf-btn mt-5 w-full bg-white text-violet-950" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export function DressUpPanel({
  save,
  onSkin,
  onAnimal,
  onClose,
}: {
  save: KidGameSave;
  onSkin: (id: string) => void;
  onAnimal: (id: string) => void;
  onClose: () => void;
}) {
  const count = stickerCount(save);
  const skins = unlockedSkins(count);
  const animals = unlockedAnimals(count);
  return (
    <div className="wf-game-modal" data-testid="dressup-panel" role="dialog" aria-label="Skins and animals">
      <div className="wf-game-card max-h-[85vh] overflow-y-auto">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-violet-950">Cool looks</h2>
        <p className="mt-3 text-left text-sm font-extrabold uppercase tracking-wide text-violet-600">
          Snake skins
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {SNAKE_SKINS.map((skin) => (
            <LookButton
              key={skin.id}
              item={skin}
              unlocked={skins.some((item) => item.id === skin.id)}
              selected={save.selectedSkinId === skin.id}
              onClick={() => onSkin(skin.id)}
            />
          ))}
        </div>
        <p className="mt-4 text-left text-sm font-extrabold uppercase tracking-wide text-violet-600">
          Animals
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PLAYABLE_ANIMALS.map((animal) => (
            <LookButton
              key={animal.id}
              item={animal}
              unlocked={animals.some((item) => item.id === animal.id)}
              selected={save.selectedAnimalId === animal.id}
              onClick={() => onAnimal(animal.id)}
            />
          ))}
        </div>
        <button type="button" className="wf-btn mt-5 w-full bg-white text-violet-950" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function LookButton({
  item,
  unlocked,
  selected,
  onClick,
}: {
  item: SnakeSkin | PlayableAnimal;
  unlocked: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={onClick}
      className={`rounded-2xl border-4 px-3 py-3 text-left font-extrabold ${
        selected ? "border-violet-800 bg-violet-100" : "border-white bg-white/90"
      } ${unlocked ? "text-violet-950" : "text-violet-400"}`}
    >
      <span className="text-2xl">{unlocked ? item.emoji : "🔒"}</span>
      <p>{item.label}</p>
      <p className="text-xs text-violet-600">{unlocked ? "Ready" : `${item.unlockAt} stickers`}</p>
    </button>
  );
}

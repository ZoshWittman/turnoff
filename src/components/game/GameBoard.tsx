"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  HelpCircle,
  Medal,
  Pause,
  RotateCcw,
  Sticker,
  Volume2,
  VolumeX,
  WandSparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { VoiceBadge } from "@/components/VoiceBadge";
import { DPad } from "@/components/game/DPad";
import { Snake3D } from "@/components/game/Snake3D";
import {
  AlbumPanel,
  DressUpPanel,
  HowToOverlay,
  LeaderboardPanel,
  MissOverlay,
  PauseOverlay,
} from "@/components/game/GamePanels";
import { completeReveal, createBoard, missAndReplace, restartBoard, setPendingDir, tickBoard } from "@/game/engine";
import {
  animalById,
  buildLandRound,
  emptyKidSave,
  evaluateLandRound,
  formatPlayTime,
  kindMissMessage,
  skinById,
  stickerCount,
} from "@/game/rules";
import type {
  BoardState,
  BoardTarget,
  Direction,
  GamePhase,
  GridPos,
  LandRound,
  TargetN,
  WonderFactGameTestApi,
} from "@/game/types";
import {
  haptic,
  playCelebrateSound,
  playCorrectSound,
  playEatSound,
  playLevelUpSound,
  playTimeoutSound,
  playWrongSound,
  setGameMuted,
  startBackgroundTune,
  stopBackgroundTune,
} from "@/services/sounds";
import {
  getTtsStatus,
  isSpeechSupported,
  speakFact,
  stopSpeaking,
  subscribeTtsStatus,
  type TtsStatus,
} from "@/services/tts";
import { useAppStore } from "@/store/useAppStore";
import { useGameStore } from "@/store/useGameStore";

const CHOICE_COLORS = [
  "bg-sky-300 hover:bg-sky-200",
  "bg-amber-300 hover:bg-amber-200",
  "bg-lime-300 hover:bg-lime-200",
  "bg-fuchsia-300 hover:bg-fuchsia-200",
];

type SidePanel = "none" | "album" | "scores" | "looks";

const EMPTY_SAVE = emptyKidSave();

function keyOf(pos: GridPos): string {
  return `${pos.x},${pos.y}`;
}

export function GameBoard() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const kidId = user?.id ?? "guest";
  const profile = useMemo(
    () => ({
      name: user?.displayName ?? "Kid",
      avatar: user?.avatar.emoji ?? "🦁",
    }),
    [user?.displayName, user?.avatar.emoji],
  );
  const save = useGameStore((state) => state.byKid[kidId]) ?? EMPTY_SAVE;
  const leaderboard = useGameStore((state) => state.leaderboard);
  const persistMuted = useGameStore((state) => state.setMuted);
  const markHowToSeen = useGameStore((state) => state.markHowToSeen);
  const selectSkin = useGameStore((state) => state.selectSkin);
  const selectAnimal = useGameStore((state) => state.selectAnimal);
  const collectSticker = useGameStore((state) => state.collectSticker);
  const addPlayTime = useGameStore((state) => state.addPlayTime);
  const setSpeaking = useAppStore((state) => state.setSpeaking);
  const isSpeaking = useAppStore((state) => state.isSpeaking);

  const [board, setBoard] = useState<BoardState>(() => createBoard());
  const [phase, setPhase] = useState<GamePhase>(save.seenHowTo ? "playing" : "howto");
  const [round, setRound] = useState<LandRound | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [remainingMs, setRemainingMs] = useState(0);
  const [missMessage, setMissMessage] = useState("Almost!");
  const [panel, setPanel] = useState<SidePanel>("none");
  const [unlockNote, setUnlockNote] = useState<string | null>(null);
  const [ttsStatus, setTtsStatus] = useState<TtsStatus>(() => getTtsStatus());
  const [speechSupported] = useState(() => isSpeechSupported());
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const boardRef = useRef(board);
  const phaseRef = useRef(phase);
  const panelRef = useRef(panel);
  const roundRef = useRef(round);
  const correctCountRef = useRef(correctCount);
  const deadlineRef = useRef(0);
  boardRef.current = board;
  phaseRef.current = phase;
  panelRef.current = panel;
  roundRef.current = round;
  correctCountRef.current = correctCount;

  const skin = skinById(save.selectedSkinId);
  const animal = animalById(save.selectedAnimalId);
  const muted = save.muted;
  const stickers = stickerCount(save);

  useEffect(() => {
    setGameMuted(muted);
  }, [muted]);

  useEffect(() => {
    const applyHydration = () => {
      const next = useGameStore.getState().byKid[kidId];
      if (next?.seenHowTo) {
        setPhase((prev) => (prev === "howto" ? "playing" : prev));
      }
    };
    if (useGameStore.persist.hasHydrated()) applyHydration();
    return useGameStore.persist.onFinishHydration(applyHydration);
  }, [kidId]);

  useEffect(() => {
    const unsub = subscribeTtsStatus(setTtsStatus);
    return () => {
      unsub();
      stopSpeaking();
      stopBackgroundTune();
    };
  }, []);

  useEffect(() => {
    if (phase === "playing" && !muted && !reduceMotion) startBackgroundTune();
    else stopBackgroundTune();
    return () => stopBackgroundTune();
  }, [phase, muted, reduceMotion]);

  const beginTrivia = useCallback(
    (target: BoardTarget) => {
      phaseRef.current = "trivia";
      playEatSound();
      haptic(14);
      const next = buildLandRound(target.fact, target.n);
      next.target = target;
      setRound(next);
      setQuestionIndex(0);
      setCorrectCount(0);
      setWrongIds([]);
      deadlineRef.current = Date.now() + next.timeLimitMs;
      setRemainingMs(next.timeLimitMs);
      setPhase("trivia");
      stopSpeaking();
      setSpeaking(false);
    },
    [setSpeaking],
  );

  const finishMiss = useCallback(
    (reason: "wrong" | "timeout" | "count-mismatch") => {
      if (reason === "timeout") playTimeoutSound();
      else playWrongSound();
      haptic(10);
      setMissMessage(kindMissMessage(reason));
      setPhase("miss");
      stopSpeaking();
      setSpeaking(false);
    },
    [setSpeaking],
  );

  const finishSuccess = useCallback(() => {
    const current = roundRef.current;
    if (!current) return;
    const award = collectSticker(kidId, current.target.fact, profile);
    playCelebrateSound();
    haptic([12, 40, 12]);
    if (award.unlockedAnimal) {
      setUnlockNote(`${award.unlockedAnimal.emoji} New friend: ${award.unlockedAnimal.label}!`);
    } else if (award.unlockedSkin) {
      setUnlockNote(`${award.unlockedSkin.emoji} New colors: ${award.unlockedSkin.label}!`);
    } else {
      setUnlockNote(null);
    }
    setPhase("reveal");
    if (speechSupported) {
      setSpeaking(true);
      speakFact(`${current.target.fact.title}. ${current.target.fact.fact}`, () => setSpeaking(false));
    }
  }, [collectSticker, kidId, profile, setSpeaking, speechSupported]);

  useEffect(() => {
    if (phase !== "playing" || panel !== "none") return;
    const id = window.setInterval(() => {
      if (phaseRef.current !== "playing" || panelRef.current !== "none") return;
      const result = tickBoard(boardRef.current);
      boardRef.current = result.board;
      setBoard(result.board);
      if (result.landed) beginTrivia(result.landed);
    }, board.tickMs);
    return () => window.clearInterval(id);
  }, [beginTrivia, board.tickMs, phase, panel]);

  useEffect(() => {
    if (phase !== "trivia") return;
    const id = window.setInterval(() => {
      const left = deadlineRef.current - Date.now();
      setRemainingMs(left);
      if (left <= 0) {
        const current = roundRef.current;
        if (!current || phaseRef.current !== "trivia") return;
        finishMiss("timeout");
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [finishMiss, phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      addPlayTime(kidId, 1000, profile);
    }, 1000);
    return () => window.clearInterval(id);
  }, [addPlayTime, kidId, phase, profile]);

  const steer = useCallback((dir: Direction) => {
    if (phaseRef.current !== "playing" || panelRef.current !== "none") return;
    const next = setPendingDir(boardRef.current, dir);
    boardRef.current = next;
    setBoard(next);
  }, []);

  useEffect(() => {
    if (phase === "playing" && panel === "none") {
      shellRef.current?.focus({ preventScroll: true });
    }
  }, [phase, panel]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const map: Record<string, Direction> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        a: "left",
        s: "down",
        d: "right",
      };
      const dir = map[event.key] ?? map[event.key.toLowerCase()];
      if (!dir) return;
      event.preventDefault();
      steer(dir);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [steer]);

  useEffect(() => {
    const api: WonderFactGameTestApi = {
      landOn: (n: TargetN) => {
        const target = board.targets.find((item) => item.n === n);
        if (target) beginTrivia(target);
      },
      snapshot: () => ({
        phase: phaseRef.current,
        dir: boardRef.current.dir,
        head: boardRef.current.snake[0],
        targets: board.targets.map((target) => ({
          n: target.n,
          emoji: target.fact.emoji,
          title: target.fact.title,
        })),
        stickerCount: stickers,
        muted,
      }),
    };
    window.__WF_GAME_TEST__ = api;
    return () => {
      if (window.__WF_GAME_TEST__ === api) delete window.__WF_GAME_TEST__;
    };
  }, [beginTrivia, board.targets, muted, stickers]);

  const snakeCells = useMemo(() => {
    const set = new Set<string>();
    for (const pos of board.snake) set.add(keyOf(pos));
    return set;
  }, [board.snake]);

  const targetMap = useMemo(() => {
    const map = new Map<string, BoardTarget>();
    for (const target of board.targets) map.set(keyOf(target.pos), target);
    return map;
  }, [board.targets]);

  function handleChoice(id: string) {
    if (phase !== "trivia" || !round) return;
    const question = round.questions[questionIndex];
    if (!question) return;
    const choice = question.choices.find((item) => item.id === id);
    if (!choice || wrongIds.includes(id)) return;
    if (!choice.isCorrect) {
      setWrongIds((prev) => [...prev, id]);
      finishMiss("wrong");
      return;
    }
    playCorrectSound();
    const nextCorrect = correctCount + 1;
    setCorrectCount(nextCorrect);
    if (questionIndex + 1 < round.questions.length) {
      setQuestionIndex(questionIndex + 1);
      setWrongIds([]);
      return;
    }
    const judged = evaluateLandRound({
      targetN: round.target.n,
      questionCount: round.questions.length,
      correctCount: nextCorrect,
      timedOut: remainingMs <= 0,
      elapsedMs: round.timeLimitMs - Math.max(0, remainingMs),
    });
    if (judged.success) finishSuccess();
    else finishMiss(judged.reason === "timeout" ? "timeout" : "wrong");
  }

  function resumeAfterMiss() {
    if (round) {
      const next = missAndReplace(boardRef.current, round.target.n);
      boardRef.current = next;
      setBoard(next);
    }
    setRound(null);
    setPhase("playing");
  }

  function continueAfterReveal() {
    if (!round) {
      setPhase("playing");
      return;
    }
    const n = round.target.n;
    const previousLevel = boardRef.current.level;
    const next = completeReveal(boardRef.current, n);
    boardRef.current = next;
    setBoard(next);
    setRound(null);
    stopSpeaking();
    setSpeaking(false);
    if (next.level > previousLevel) {
      playLevelUpSound();
      setPhase("levelup");
      window.setTimeout(() => setPhase("playing"), reduceMotion ? 400 : 1400);
      return;
    }
    setPhase("playing");
  }

  function restart() {
    stopSpeaking();
    setSpeaking(false);
    const next = restartBoard();
    boardRef.current = next;
    setBoard(next);
    setRound(null);
    setPanel("none");
    setPhase("playing");
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    touchRef.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? "right" : "left");
    else steer(dy > 0 ? "down" : "up");
  }

  const question = round?.questions[questionIndex];
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const cells = board.cols * board.rows;

  return (
    <section
      ref={shellRef}
      className="flex w-full flex-col items-center gap-3 outline-none"
      data-testid="game-board"
      tabIndex={0}
      aria-label="WonderFact snake game"
    >
      <div className="flex w-full max-w-xl flex-wrap items-center justify-between gap-2">
        <p className="rounded-full bg-white/80 px-3 py-1 text-sm font-extrabold text-violet-800">
          {animal.emoji} Lv {board.level} · {stickers} ⭐ · {formatPlayTime(save.playTimeMs)}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="wf-icon-btn"
            data-testid="mute-btn"
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={muted}
            onClick={() => persistMuted(kidId, !muted)}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
          <button
            type="button"
            className="wf-icon-btn"
            data-testid="pause-btn"
            aria-label="Pause"
            onClick={() => setPhase("paused")}
          >
            <Pause />
          </button>
          <button type="button" className="wf-icon-btn" aria-label="Restart" onClick={restart}>
            <RotateCcw />
          </button>
          <button
            type="button"
            className="wf-icon-btn"
            data-testid="howto-btn"
            aria-label="How to"
            onClick={() => setPhase("howto")}
          >
            <HelpCircle />
          </button>
        </div>
      </div>

      <div
        className="wf-board-wrap"
        style={{
          ["--wf-cols" as string]: board.cols,
          ["--wf-rows" as string]: board.rows,
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          touchRef.current = null;
        }}
        role="application"
        aria-label="WonderFact game board"
      >
        <div
          className="wf-board"
          style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cells }, (_, index) => {
            const x = index % board.cols;
            const y = Math.floor(index / board.cols);
            const target = targetMap.get(`${x},${y}`);
            const covered = snakeCells.has(`${x},${y}`);
            return (
              <div
                key={`${x}-${y}`}
                className={`wf-cell ${target ? "wf-target" : ""}`}
                data-testid={target ? `target-${target.n}` : undefined}
              >
                {target ? (
                  <span className={`flex flex-col items-center leading-none ${covered ? "opacity-40" : ""}`}>
                    <span className="text-lg font-black text-violet-950 sm:text-xl">{target.n}</span>
                    <span className="text-base sm:text-lg" aria-hidden>
                      {target.fact.emoji}
                    </span>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <Snake3D
          snake={board.snake}
          dir={board.dir}
          cols={board.cols}
          rows={board.rows}
          skin={skin}
          animal={animal}
        />
      </div>

      <p className="text-sm font-extrabold text-violet-800">Arrows or WASD · swipe the board</p>

      <DPad onSteer={steer} disabled={phase !== "playing" || panel !== "none"} />

      <div className="grid w-full max-w-xl grid-cols-3 gap-2">
        <button
          type="button"
          className="wf-btn bg-amber-200 text-violet-950"
          data-testid="album-btn"
          onClick={() => setPanel("album")}
        >
          <Sticker size={20} /> Album
        </button>
        <button
          type="button"
          className="wf-btn bg-sky-200 text-violet-950"
          data-testid="leaderboard-btn"
          onClick={() => setPanel("scores")}
        >
          <Medal size={20} /> Stars
        </button>
        <button type="button" className="wf-btn bg-fuchsia-200 text-violet-950" onClick={() => setPanel("looks")}>
          <WandSparkles size={20} /> Looks
        </button>
      </div>

      <AnimatePresence>
        {phase === "trivia" && round && question ? (
          <motion.div
            className="wf-game-modal"
            data-testid="trivia-overlay"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="wf-game-card">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-sm font-extrabold text-violet-800">
                  {round.target.n} {round.target.fact.emoji} · {questionIndex + 1}/{round.questions.length}
                </span>
                <span
                  data-testid="countdown"
                  aria-live="polite"
                  className={`rounded-full px-4 py-1 text-2xl font-black ${
                    seconds <= 5 ? "bg-rose-200 text-rose-800" : "bg-lime-200 text-emerald-800"
                  }`}
                >
                  {seconds}s
                </span>
              </div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl text-violet-950">{question.prompt}</h2>
              <div className="mt-4 grid gap-3">
                {question.choices.map((choice, index) => (
                  <button
                    key={choice.id}
                    type="button"
                    data-testid={`trivia-choice-${index}`}
                    data-correct={choice.isCorrect ? "true" : "false"}
                    className={`wf-btn min-h-[4rem] text-left text-lg text-violet-950 ${CHOICE_COLORS[index % CHOICE_COLORS.length]}`}
                    onClick={() => handleChoice(choice.id)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}

        {phase === "reveal" && round ? (
          <motion.div
            className="wf-game-modal"
            data-testid="reveal-overlay"
            initial={reduceMotion ? false : { scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="wf-game-card">
              <p className="wf-celebrate text-6xl" aria-hidden>
                {round.target.fact.emoji}
              </p>
              <p className="mt-2 text-lg font-extrabold text-emerald-700">Sticker earned!</p>
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-violet-950">
                {round.target.fact.title}
              </h2>
              <p className="mt-3 text-lg font-bold text-violet-900">{round.target.fact.fact}</p>
              {unlockNote ? (
                <p className="mt-3 rounded-2xl bg-amber-100 px-3 py-2 font-extrabold text-amber-900">{unlockNote}</p>
              ) : null}
              {speechSupported ? (
                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    className="wf-btn bg-sky-400 text-violet-950"
                    onClick={() => {
                      if (isSpeaking) {
                        stopSpeaking();
                        setSpeaking(false);
                        return;
                      }
                      setSpeaking(true);
                      speakFact(`${round.target.fact.title}. ${round.target.fact.fact}`, () => setSpeaking(false));
                    }}
                  >
                    {isSpeaking ? <VolumeX size={24} /> : <Volume2 size={24} />}
                    {isSpeaking ? "Shh!" : "Read To Me!"}
                  </button>
                  {ttsStatus.voiceName ? (
                    <VoiceBadge
                      name={ttsStatus.voiceName}
                      loading={ttsStatus.loading}
                      progress={ttsStatus.progress}
                      engine={ttsStatus.engine}
                    />
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                data-testid="reveal-continue"
                className="wf-btn mt-3 w-full bg-lime-300 text-violet-950"
                onClick={continueAfterReveal}
              >
                Keep playing
              </button>
            </div>
          </motion.div>
        ) : null}

        {phase === "levelup" ? (
          <div className="wf-game-modal" data-testid="levelup-overlay">
            <div className="wf-game-card">
              <p className="text-6xl">🚀</p>
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-violet-950">Faster fun!</h2>
              <p className="font-bold text-violet-800">Level {board.level}</p>
            </div>
          </div>
        ) : null}
      </AnimatePresence>

      {phase === "howto" ? (
        <HowToOverlay
          onStart={() => {
            markHowToSeen(kidId);
            setPhase("playing");
          }}
        />
      ) : null}
      {phase === "paused" ? (
        <PauseOverlay onResume={() => setPhase("playing")} onRestart={restart} onHowTo={() => setPhase("howto")} />
      ) : null}
      {phase === "miss" ? <MissOverlay message={missMessage} onContinue={resumeAfterMiss} /> : null}
      {panel === "album" ? <AlbumPanel save={save} onClose={() => setPanel("none")} /> : null}
      {panel === "scores" ? (
        <LeaderboardPanel entries={leaderboard} kidId={kidId} onClose={() => setPanel("none")} />
      ) : null}
      {panel === "looks" ? (
        <DressUpPanel
          save={save}
          onSkin={(id) => selectSkin(kidId, id)}
          onAnimal={(id) => selectAnimal(kidId, id)}
          onClose={() => setPanel("none")}
        />
      ) : null}
    </section>
  );
}

declare global {
  interface Window {
    __WF_GAME_TEST__?: WonderFactGameTestApi;
  }
}

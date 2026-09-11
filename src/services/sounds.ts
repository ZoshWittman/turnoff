type SoundName =
  | "eat"
  | "correct"
  | "wrong"
  | "timeout"
  | "levelup"
  | "celebrate"
  | "star"
  | "surprise"
  | "tap";

let muted = false;
let bgmTimer: number | null = null;
let bgmStep = 0;

function canPlay(): boolean {
  return typeof window !== "undefined" && !muted;
}

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

function beep(frequency: number, duration = 0.16, type: OscillatorType = "triangle", volume = 0.08) {
  if (!canPlay()) return;
  const ctx = audioContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  oscillator.stop(ctx.currentTime + duration);
  oscillator.onended = () => {
    void ctx.close();
  };
}

export function isGameMuted(): boolean {
  return muted;
}

export function setGameMuted(value: boolean): void {
  muted = value;
  if (muted) stopBackgroundTune();
}

export function playSurpriseSound(): void {
  beep(392, 0.12);
  setTimeout(() => beep(523, 0.12), 90);
  setTimeout(() => beep(659, 0.18), 180);
}

export function playStarSound(): void {
  beep(660, 0.1, "sine");
  setTimeout(() => beep(880, 0.18, "sine"), 80);
}

export function playTapSound(): void {
  beep(520, 0.08, "sine");
}

export function playCelebrateSound(): void {
  beep(523, 0.1, "sine");
  setTimeout(() => beep(659, 0.1, "sine"), 90);
  setTimeout(() => beep(784, 0.12, "triangle"), 180);
  setTimeout(() => beep(1046, 0.22, "sine"), 280);
}

export function playTryAgainSound(): void {
  beep(392, 0.12, "sine");
  setTimeout(() => beep(349, 0.18, "sine"), 140);
}

export function playEatSound(): void {
  beep(440, 0.08, "square", 0.05);
  setTimeout(() => beep(660, 0.12, "triangle", 0.07), 70);
}

export function playCorrectSound(): void {
  beep(587, 0.1, "sine");
  setTimeout(() => beep(784, 0.16, "sine"), 90);
}

export function playWrongSound(): void {
  playTryAgainSound();
}

export function playTimeoutSound(): void {
  beep(330, 0.16, "sine");
  setTimeout(() => beep(294, 0.22, "triangle"), 160);
}

export function playLevelUpSound(): void {
  beep(523, 0.1, "sine");
  setTimeout(() => beep(659, 0.1, "sine"), 80);
  setTimeout(() => beep(784, 0.1, "sine"), 160);
  setTimeout(() => beep(1046, 0.22, "triangle"), 240);
}

export function playGameSound(name: SoundName): void {
  if (name === "eat") playEatSound();
  else if (name === "correct") playCorrectSound();
  else if (name === "wrong") playWrongSound();
  else if (name === "timeout") playTimeoutSound();
  else if (name === "levelup") playLevelUpSound();
  else if (name === "celebrate") playCelebrateSound();
  else if (name === "star") playStarSound();
  else if (name === "surprise") playSurpriseSound();
  else playTapSound();
}

const BGM_NOTES = [392, 494, 587, 659, 587, 494];

export function startBackgroundTune(): void {
  if (!canPlay() || bgmTimer !== null) return;
  const prefersReduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduce) return;
  bgmStep = 0;
  bgmTimer = window.setInterval(() => {
    if (!canPlay()) return;
    const note = BGM_NOTES[bgmStep % BGM_NOTES.length]!;
    bgmStep += 1;
    beep(note, 0.18, "sine", 0.02);
  }, 420);
}

export function stopBackgroundTune(): void {
  if (bgmTimer !== null) {
    window.clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

export function haptic(pattern: number | number[] = 12): void {
  if (muted) return;
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

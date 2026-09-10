function beep(frequency: number, duration = 0.16, type: OscillatorType = "triangle") {
  if (typeof window === "undefined") return;
  const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  const ctx = new AudioContextCtor();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.08;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  oscillator.stop(ctx.currentTime + duration);
  oscillator.onended = () => {
    void ctx.close();
  };
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

export function haptic(pattern: number | number[] = 12): void {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

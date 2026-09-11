export interface RankableVoice {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

export interface KidVoiceProfile {
  pitch: number;
  rate: number;
  lang: string;
}

const PITCH_MIN = 1.2;
const PITCH_MAX = 1.45;
const RATE_MIN = 0.9;
const RATE_MAX = 1.05;

const DEFAULT_PROFILE: KidVoiceProfile = {
  pitch: 1.28,
  rate: 0.95,
  lang: "en-US",
};

/** Higher scores win. Child-like, female, and well-known cheery English voices rank first. */
const POSITIVE_NAME_HINTS: Array<[RegExp, number]> = [
  [/\b(child|kid|girl)\b/i, 150],
  [/samantha/i, 130],
  [/\bkaren\b/i, 112],
  [/\bzira\b/i, 108],
  [/google us english/i, 102],
  [/microsoft (zira|aria|jenny|eva|sara)/i, 100],
  [/\b(siri|victoria|moira|tessa|fiona|veena|serena|hazel|linda)\b/i, 88],
  [/\b(aria|jenny|emma|ava|allison|salli|ivy|joanna|kendra|kimberly|nicole|raveena|amy)\b/i, 84],
  [/\b(female|woman)\b/i, 72],
  [/\b(neural|natural|premium|enhanced)\b/i, 36],
  [/\bgoogle\b/i, 22],
  [/\bmicrosoft\b/i, 12],
];

const NEGATIVE_NAME_HINTS: Array<[RegExp, number]> = [
  [/\b(male|man|david|mark|daniel|fred|george|thomas|richard|james|matthew|alex)\b/i, -28],
  [/\bcompact\b/i, -16],
  [/whisper|scary|monster/i, -80],
];

let selectedVoice: SpeechSynthesisVoice | null = null;
let selectedProfile: KidVoiceProfile = DEFAULT_PROFILE;
let voicesListenerBound = false;
let pendingSpeak: { text: string; onEnd?: () => void } | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function logChosenVoice(name: string): void {
  if (typeof console === "undefined" || typeof console.debug !== "function") return;
  // Voice names are not secrets; log the name only (never utterance text or keys).
  console.debug("[WonderFact TTS] voice:", name.slice(0, 80));
}

export function scoreVoice(voice: RankableVoice): number {
  const lang = voice.lang?.toLowerCase() ?? "";
  const name = voice.name ?? "";
  let score = 0;

  if (lang.startsWith("en-us")) score += 55;
  else if (lang.startsWith("en")) score += 38;

  if (voice.localService) score += 18;
  if (voice.default) score += 4;

  let nameBonus = 0;
  for (const [pattern, points] of POSITIVE_NAME_HINTS) {
    if (pattern.test(name)) nameBonus = Math.max(nameBonus, points);
  }
  score += nameBonus;

  for (const [pattern, points] of NEGATIVE_NAME_HINTS) {
    if (pattern.test(name) && !/samantha|female|girl|zira|karen/i.test(name)) {
      score += points;
    }
  }

  return score;
}

export function rankVoices<T extends RankableVoice>(voices: T[]): T[] {
  return [...voices].sort((a, b) => {
    const delta = scoreVoice(b) - scoreVoice(a);
    if (delta !== 0) return delta;
    return a.name.localeCompare(b.name);
  });
}

export function pickKidFriendlyVoice<T extends RankableVoice>(voices: T[]): T | undefined {
  if (voices.length === 0) return undefined;
  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const pool = english.length > 0 ? english : voices;
  return rankVoices(pool)[0];
}

export function kidVoiceProfile(voice?: RankableVoice): KidVoiceProfile {
  if (!voice) return { ...DEFAULT_PROFILE };

  const name = voice.name;
  const alreadyChild = /\b(child|kid|girl)\b/i.test(name);
  const femaleHint =
    /female|samantha|karen|zira|aria|jenny|siri|victoria|woman|girl/i.test(name);
  const maleHint =
    /\b(male|man|david|mark|daniel|fred|george|alex)\b/i.test(name) && !femaleHint;

  let pitch = DEFAULT_PROFILE.pitch;
  let rate = DEFAULT_PROFILE.rate;
  if (alreadyChild) {
    pitch = 1.22;
    rate = 0.98;
  } else if (maleHint) {
    pitch = 1.42;
    rate = 0.92;
  } else if (femaleHint) {
    pitch = 1.32;
    rate = 0.94;
  }

  const lang = voice.lang.toLowerCase().startsWith("en") ? voice.lang : "en-US";
  return {
    pitch: clamp(pitch, PITCH_MIN, PITCH_MAX),
    rate: clamp(rate, RATE_MIN, RATE_MAX),
    lang: /en-us/i.test(lang) ? "en-US" : lang,
  };
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function getChosenVoiceName(): string | null {
  return selectedVoice?.name ?? null;
}

function selectBestVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const next = pickKidFriendlyVoice(voices) ?? null;
  selectedVoice = next;
  selectedProfile = kidVoiceProfile(next ?? undefined);
  if (next) logChosenVoice(next.name);
  return next;
}

function bindVoicesListener(): void {
  if (!isSpeechSupported() || voicesListenerBound) return;
  voicesListenerBound = true;
  const refresh = () => {
    selectBestVoice();
    if (pendingSpeak && window.speechSynthesis.getVoices().length > 0) {
      const job = pendingSpeak;
      pendingSpeak = null;
      speakNow(job.text, job.onEnd);
    }
  };
  if (typeof window.speechSynthesis.addEventListener === "function") {
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
  } else {
    window.speechSynthesis.onvoiceschanged = refresh;
  }
}

export function stopSpeaking(): void {
  pendingSpeak = null;
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
}

function speakNow(text: string, onEnd?: () => void): void {
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = selectedVoice ?? selectBestVoice();
  const profile = voice ? kidVoiceProfile(voice) : selectedProfile;
  selectedProfile = profile;
  utterance.rate = profile.rate;
  utterance.pitch = profile.pitch;
  utterance.lang = profile.lang || "en-US";
  if (voice) utterance.voice = voice;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export function speakFact(text: string, onEnd?: () => void): void {
  if (!isSpeechSupported()) {
    onEnd?.();
    return;
  }
  stopSpeaking();
  bindVoicesListener();
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    pendingSpeak = { text, onEnd };
    window.setTimeout(() => {
      if (!pendingSpeak) return;
      const job = pendingSpeak;
      pendingSpeak = null;
      speakNow(job.text, job.onEnd);
    }, 450);
    return;
  }
  selectBestVoice();
  speakNow(text, onEnd);
}

export function preloadVoices(): void {
  if (!isSpeechSupported()) return;
  bindVoicesListener();
  window.speechSynthesis.getVoices();
  selectBestVoice();
}

/** Test helper: reset module voice cache. */
export function resetTtsForTests(): void {
  selectedVoice = null;
  selectedProfile = { ...DEFAULT_PROFILE };
  voicesListenerBound = false;
  pendingSpeak = null;
}

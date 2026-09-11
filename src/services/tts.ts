import { logError } from "@/lib/safeLog";
import {
  DEFAULT_NEURAL_SPEED,
  DEFAULT_NEURAL_VOICE_ID,
  NEURAL_VOICE_OPTIONS,
  getNeuralLoadState,
  isNeuralAvailable,
  neuralVoiceLabel,
  preloadNeuralEngine,
  speakWithNeural,
  stopNeuralPlayback,
  subscribeNeuralStatus,
  unlockNeuralAudio,
} from "@/services/neuralTts";
import { cheerifySpokenText } from "@/services/spokenText";

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

export type TtsEngine = "neural" | "browser" | "none";

export interface VoicePlan {
  engine: TtsEngine;
  voiceId: string;
  displayName: string;
  reason: string;
}

export interface SpeakableVoiceChoice {
  id: string;
  label: string;
  engine: "auto" | "neural" | "browser";
}

export interface TtsStatus {
  engine: TtsEngine;
  voiceName: string;
  voiceId: string;
  loading: boolean;
  progress: number;
  ready: boolean;
}

const PITCH_MIN = 1.22;
const PITCH_MAX = 1.5;
const RATE_MIN = 1.0;
const RATE_MAX = 1.16;

const DEFAULT_PROFILE: KidVoiceProfile = {
  pitch: 1.35,
  rate: 1.08,
  lang: "en-US",
};

const AUTO_VOICE_ID = "auto";

/** Higher scores win. Child-like, female, and well-known cheery English voices rank first. */
const POSITIVE_NAME_HINTS: Array<[RegExp, number]> = [
  [/\b(child|kid|girl)\b/i, 150],
  [/samantha/i, 130],
  [/google uk english female/i, 118],
  [/\bkaren\b/i, 112],
  [/\bzira\b/i, 108],
  [/google us english female/i, 104],
  [/microsoft (zira|aria|jenny|eva|sara)/i, 100],
  [/\b(siri|victoria|moira|tessa|fiona|veena|serena|hazel|linda)\b/i, 88],
  [/\b(aria|jenny|emma|ava|allison|salli|ivy|joanna|kendra|kimberly|nicole|raveena|amy)\b/i, 84],
  [/\b(female|woman)\b/i, 72],
  [/\b(neural|natural|premium|enhanced)\b/i, 90],
  [/\bgoogle\b/i, 22],
  [/\bmicrosoft\b/i, 12],
];

const NEGATIVE_NAME_HINTS: Array<[RegExp, number]> = [
  [/\b(male|man|david|mark|daniel|fred|george|thomas|richard|james|matthew|alex)\b/i, -28],
  [/\b(espeak|compact|dummy|festival|mbrola|pico)\b/i, -120],
  [/whisper|scary|monster/i, -80],
];

const ROBOTIC_NAME =
  /\b(espeak|compact|dummy|festival|mbrola|pico|sapi|chromoting|android)\b|microsoft (david|mark)|google us english$/i;

const QUALITY_NATIVE_NAME =
  /samantha|\bkaren\b|\bzira\b|neural|natural|premium|enhanced|\b(child|kid|girl)\b|google uk english female|google us english female|microsoft (aria|jenny|eva|sara)|victoria|moira|tessa|fiona|veena|serena|hazel/i;

let selectedVoice: SpeechSynthesisVoice | null = null;
let selectedProfile: KidVoiceProfile = DEFAULT_PROFILE;
let voicesListenerBound = false;
let pendingSpeak: { text: string; onEnd?: () => void } | null = null;
let preferredVoiceId = AUTO_VOICE_ID;
let activePlan: VoicePlan = {
  engine: "neural",
  voiceId: `neural:${DEFAULT_NEURAL_VOICE_ID}`,
  displayName: neuralVoiceLabel(DEFAULT_NEURAL_VOICE_ID),
  reason: "default-neural",
};
const statusListeners = new Set<(status: TtsStatus) => void>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function logChosenVoice(plan: VoicePlan): void {
  if (typeof console === "undefined" || typeof console.debug !== "function") return;
  console.debug("[WonderFact TTS] engine:", plan.engine, "voice:", plan.displayName.slice(0, 80));
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

  if (isRoboticVoice(voice)) score -= 160;
  if (isQualityNativeVoice(voice)) score += 40;

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

export function isRoboticVoice(voice: RankableVoice): boolean {
  const name = voice.name ?? "";
  return ROBOTIC_NAME.test(name);
}

export function isQualityNativeVoice(voice: RankableVoice): boolean {
  const name = voice.name ?? "";
  if (isRoboticVoice(voice)) return false;
  return QUALITY_NATIVE_NAME.test(name);
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
    pitch = 1.28;
    rate = 1.1;
  } else if (maleHint) {
    pitch = 1.46;
    rate = 1.06;
  } else if (femaleHint) {
    pitch = 1.36;
    rate = 1.08;
  }

  const lang = voice.lang.toLowerCase().startsWith("en") ? voice.lang : "en-US";
  return {
    pitch: clamp(pitch, PITCH_MIN, PITCH_MAX),
    rate: clamp(rate, RATE_MIN, RATE_MAX),
    lang: /en-us/i.test(lang) ? "en-US" : lang,
  };
}

export function isSpeechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return isNeuralAvailable() || "speechSynthesis" in window;
}

export function getChosenVoiceName(): string | null {
  return activePlan.displayName || null;
}

export function configureTts(options: { preferredVoiceId?: string }): void {
  if (options.preferredVoiceId) preferredVoiceId = options.preferredVoiceId;
  refreshPlan();
}

function browserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

function neuralPlan(voiceId = DEFAULT_NEURAL_VOICE_ID, reason = "neural-default"): VoicePlan {
  const id = NEURAL_VOICE_OPTIONS.some((item) => item.id === voiceId) ? voiceId : DEFAULT_NEURAL_VOICE_ID;
  return {
    engine: "neural",
    voiceId: `neural:${id}`,
    displayName: neuralVoiceLabel(id),
    reason,
  };
}

export function resolveVoicePlan(
  voices: RankableVoice[],
  preferredId: string = AUTO_VOICE_ID,
): VoicePlan {
  if (preferredId.startsWith("neural:")) {
    return neuralPlan(preferredId.slice("neural:".length), "parent-neural");
  }
  if (preferredId.startsWith("browser:")) {
    const wanted = preferredId.slice("browser:".length);
    const match = voices.find((voice) => voice.name === wanted);
    if (match) {
      return {
        engine: "browser",
        voiceId: preferredId,
        displayName: match.name,
        reason: "parent-browser",
      };
    }
  }

  const quality = rankVoices(voices.filter((voice) => isQualityNativeVoice(voice)));
  if (quality[0]) {
    return {
      engine: "browser",
      voiceId: `browser:${quality[0].name}`,
      displayName: quality[0].name,
      reason: "quality-native",
    };
  }

  return neuralPlan(DEFAULT_NEURAL_VOICE_ID, voices.length === 0 ? "no-browser-voices" : "browser-voices-robotic");
}

export function listSpeakableVoices(voices: RankableVoice[] = browserVoices()): SpeakableVoiceChoice[] {
  const choices: SpeakableVoiceChoice[] = [
    { id: AUTO_VOICE_ID, label: "Auto (best storyteller)", engine: "auto" },
    ...NEURAL_VOICE_OPTIONS.map((voice) => ({
      id: `neural:${voice.id}`,
      label: `${voice.name} — ${voice.blurb} (neural)`,
      engine: "neural" as const,
    })),
  ];
  const ranked = rankVoices(voices.filter((voice) => voice.lang.toLowerCase().startsWith("en")));
  for (const voice of ranked) {
    choices.push({
      id: `browser:${voice.name}`,
      label: `${voice.name}${isRoboticVoice(voice) ? " (robotic)" : ""}`,
      engine: "browser",
    });
  }
  return choices;
}

function refreshPlan(): VoicePlan {
  const voices = browserVoices();
  const next = resolveVoicePlan(voices, preferredVoiceId);
  activePlan = next;
  if (next.engine === "browser") {
    const name = next.voiceId.startsWith("browser:") ? next.voiceId.slice("browser:".length) : next.displayName;
    selectedVoice = voices.find((voice) => voice.name === name) ?? pickKidFriendlyVoice(voices) ?? null;
    selectedProfile = kidVoiceProfile(selectedVoice ?? undefined);
  } else {
    selectedVoice = null;
    selectedProfile = { ...DEFAULT_PROFILE };
  }
  emitStatus();
  return next;
}

export function getTtsStatus(): TtsStatus {
  const neural = getNeuralLoadState();
  const loading = activePlan.engine === "neural" && neural.loading && !neural.error;
  return {
    engine: activePlan.engine,
    voiceName: activePlan.displayName,
    voiceId: activePlan.voiceId,
    loading,
    progress: activePlan.engine === "neural" ? neural.progress : 1,
    ready: activePlan.engine !== "neural" || neural.progress >= 1,
  };
}

export function subscribeTtsStatus(listener: (status: TtsStatus) => void): () => void {
  statusListeners.add(listener);
  listener(getTtsStatus());
  return () => {
    statusListeners.delete(listener);
  };
}

function emitStatus(): void {
  const status = getTtsStatus();
  for (const listener of statusListeners) listener(status);
}

function selectBestVoice(): SpeechSynthesisVoice | null {
  refreshPlan();
  return selectedVoice;
}

function bindVoicesListener(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || voicesListenerBound) return;
  voicesListenerBound = true;
  const refresh = () => {
    refreshPlan();
    if (pendingSpeak && (browserVoices().length > 0 || isNeuralAvailable())) {
      const job = pendingSpeak;
      pendingSpeak = null;
      void speakNow(job.text, job.onEnd);
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
  stopNeuralPlayback();
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

function speakBrowser(text: string, onEnd?: () => void): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = selectedVoice ?? selectBestVoice();
  const profile = voice ? kidVoiceProfile(voice) : selectedProfile;
  selectedProfile = profile;
  utterance.rate = profile.rate;
  utterance.pitch = profile.pitch;
  utterance.lang = profile.lang || "en-US";
  if (voice) utterance.voice = voice;
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    onEnd?.();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  window.speechSynthesis.speak(utterance);
  const estimateMs = Math.min(20000, 800 + text.length * 60);
  window.setTimeout(finish, browserVoices().length === 0 ? 400 : estimateMs);
}

async function speakNow(text: string, onEnd?: () => void): Promise<void> {
  const spoken = cheerifySpokenText(text);
  const plan = refreshPlan();
  logChosenVoice(plan);

  if (plan.engine === "neural" && isNeuralAvailable()) {
    try {
      const neuralId = plan.voiceId.startsWith("neural:")
        ? plan.voiceId.slice("neural:".length)
        : DEFAULT_NEURAL_VOICE_ID;
      await speakWithNeural(spoken, {
        voiceId: neuralId,
        speed: DEFAULT_NEURAL_SPEED,
        onEnd,
      });
      return;
    } catch {
      logError("[WonderFact TTS] neural speak failed; trying browser voices");
    }
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    speakBrowser(spoken, onEnd);
    return;
  }
  onEnd?.();
}

export function speakFact(text: string, onEnd?: () => void): void {
  if (!isSpeechSupported()) {
    onEnd?.();
    return;
  }
  unlockNeuralAudio();
  stopSpeaking();
  bindVoicesListener();
  const voices = browserVoices();
  const plan = refreshPlan();
  if (plan.engine === "browser" && voices.length === 0) {
    pendingSpeak = { text, onEnd };
    window.setTimeout(() => {
      if (!pendingSpeak) return;
      const job = pendingSpeak;
      pendingSpeak = null;
      void speakNow(job.text, job.onEnd);
    }, 450);
    return;
  }
  void speakNow(text, onEnd);
}

export function preloadVoices(): void {
  bindVoicesListener();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.getVoices();
  }
  refreshPlan();
  if (activePlan.engine === "neural") preloadNeuralEngine();
}

if (typeof window !== "undefined") {
  subscribeNeuralStatus(() => emitStatus());
}

/** Test helper: reset module voice cache. */
export function resetTtsForTests(): void {
  selectedVoice = null;
  selectedProfile = { ...DEFAULT_PROFILE };
  voicesListenerBound = false;
  pendingSpeak = null;
  preferredVoiceId = AUTO_VOICE_ID;
  activePlan = neuralPlan(DEFAULT_NEURAL_VOICE_ID, "reset");
}

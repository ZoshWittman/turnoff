import { logError } from "@/lib/safeLog";

export const KOKORO_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
export const DEFAULT_NEURAL_VOICE_ID = "af_bella";
export const DEFAULT_NEURAL_SPEED = 1.08;

export interface NeuralVoiceOption {
  id: string;
  name: string;
  lang: string;
  blurb: string;
}

/** Warm, high-quality female/child-like Kokoro voices only. */
export const NEURAL_VOICE_OPTIONS: NeuralVoiceOption[] = [
  { id: "af_bella", name: "Bella", lang: "en-US", blurb: "warm and sparkly" },
  { id: "af_heart", name: "Heart", lang: "en-US", blurb: "sweet storyteller" },
  { id: "af_sky", name: "Sky", lang: "en-US", blurb: "bright and bouncy" },
  { id: "bf_emma", name: "Emma", lang: "en-GB", blurb: "cheery UK English" },
];

export function neuralVoiceLabel(id: string): string {
  return NEURAL_VOICE_OPTIONS.find((voice) => voice.id === id)?.name ?? "Bella";
}

interface RawAudioLike {
  audio?: Float32Array | number[];
  data?: Float32Array | number[];
  sampling_rate?: number;
}

interface KokoroEngine {
  generate: (
    text: string,
    options?: { voice?: string; speed?: number },
  ) => Promise<RawAudioLike>;
}

interface KokoroModule {
  KokoroTTS: {
    from_pretrained: (
      modelId: string,
      options: {
        dtype: "q8" | "fp32" | "q4";
        device: "wasm" | "webgpu";
        progress_callback?: (info: Record<string, unknown>) => void;
      },
    ) => Promise<KokoroEngine>;
  };
}

type StatusListener = (loading: boolean, progress: number, error: string | null) => void;

let enginePromise: Promise<KokoroEngine> | null = null;
let loading = false;
let progress = 0;
let lastError: string | null = null;
let playToken = 0;
let activeContext: AudioContext | null = null;
let activeSources: AudioBufferSourceNode[] = [];
const listeners = new Set<StatusListener>();

function emit(): void {
  for (const listener of listeners) listener(loading, progress, lastError);
}

export function subscribeNeuralStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(loading, progress, lastError);
  return () => listeners.delete(listener);
}

export function getNeuralLoadState(): { loading: boolean; progress: number; error: string | null } {
  return { loading, progress, error: lastError };
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function onProgress(info: Record<string, unknown>): void {
  if (info.status === "progress") {
    const loaded = typeof info.loaded === "number" ? info.loaded : 0;
    const total = typeof info.total === "number" ? info.total : 0;
    if (total > 0) progress = Math.min(0.99, loaded / total);
    else if (typeof info.progress === "number") progress = Math.min(0.99, info.progress / 100);
    emit();
  }
  if (info.status === "done" || info.status === "ready") {
    progress = Math.max(progress, 0.95);
    emit();
  }
}

async function loadKokoroModule(): Promise<KokoroModule> {
  const href = `${window.location.origin}/tts/kokoro.web.js`;
  // Copied to /public/tts at build time; keep this import fully dynamic so bundlers
  // do not try to parse the 2MB web bundle (or treat /public JS as an app module).
  const dynamicImport = Function("u", "return import(u)") as (u: string) => Promise<KokoroModule>;
  return dynamicImport(href);
}

async function createEngine(): Promise<KokoroEngine> {
  const { KokoroTTS } = await loadKokoroModule();
  const hasGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  if (hasGpu) {
    try {
      return await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
        dtype: "fp32",
        device: "webgpu",
        progress_callback: onProgress,
      });
    } catch {
      // SwiftShader / blocked WebGPU — WASM q8 is the portable path.
    }
  }
  return KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
    dtype: "q8",
    device: "wasm",
    progress_callback: onProgress,
  });
}

export function isNeuralAvailable(): boolean {
  if (!isBrowser()) return false;
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Boolean(AudioContextCtor);
}

export function ensureNeuralEngine(): Promise<KokoroEngine> {
  if (!isBrowser()) return Promise.reject(new Error("neural TTS is browser-only"));
  if (!enginePromise) {
    loading = true;
    progress = 0.02;
    lastError = null;
    emit();
    enginePromise = createEngine()
      .then((engine) => {
        loading = false;
        progress = 1;
        lastError = null;
        emit();
        return engine;
      })
      .catch((error) => {
        loading = false;
        lastError = "storyteller";
        enginePromise = null;
        emit();
        logError("[WonderFact TTS] neural engine failed to load");
        throw error;
      });
  }
  return enginePromise;
}

export function preloadNeuralEngine(): void {
  if (!isNeuralAvailable()) return;
  void ensureNeuralEngine().catch(() => {
    /* speechSynthesis remains the fallback */
  });
}

function splitSpokenChunks(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [text.trim()].filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    const next = current ? `${current} ${part}` : part;
    if (next.length > 180 && current) {
      chunks.push(current);
      current = part;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function samplesOf(raw: RawAudioLike): Float32Array {
  const value = raw.audio ?? raw.data;
  if (!value) return new Float32Array();
  return value instanceof Float32Array ? value : Float32Array.from(value);
}

function playBuffer(ctx: AudioContext, samples: Float32Array, sampleRate: number, when: number): AudioBufferSourceNode {
  const safeRate = sampleRate > 0 ? sampleRate : 24000;
  const buffer = ctx.createBuffer(1, Math.max(1, samples.length), safeRate);
  const channel = buffer.getChannelData(0);
  if (samples.length) channel.set(samples.subarray(0, channel.length));
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 1;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(when);
  activeSources.push(source);
  return source;
}

function stopActiveAudio(): void {
  playToken += 1;
  for (const source of activeSources) {
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
  }
  activeSources = [];
  if (activeContext) {
    const ctx = activeContext;
    activeContext = null;
    void ctx.close().catch(() => undefined);
  }
}

export function stopNeuralPlayback(): void {
  stopActiveAudio();
}

export async function speakWithNeural(
  text: string,
  options: { voiceId?: string; speed?: number; onEnd?: () => void },
): Promise<void> {
  if (!isBrowser()) {
    options.onEnd?.();
    return;
  }
  stopActiveAudio();
  const token = playToken;
  try {
    const engine = await ensureNeuralEngine();
    if (token !== playToken) {
      options.onEnd?.();
      return;
    }
    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) throw new Error("no AudioContext");
    const ctx = new AudioContextCtor();
    activeContext = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const voiceId = options.voiceId && NEURAL_VOICE_OPTIONS.some((item) => item.id === options.voiceId)
      ? options.voiceId
      : DEFAULT_NEURAL_VOICE_ID;
    const speed = options.speed ?? DEFAULT_NEURAL_SPEED;

    let cursor = ctx.currentTime + 0.04;
    let queued = 0;
    const chunks = splitSpokenChunks(text);
    for (const chunk of chunks) {
      if (token !== playToken) break;
      const audio = await engine.generate(chunk, { voice: voiceId, speed });
      if (token !== playToken) break;
      const samples = samplesOf(audio);
      if (samples.length === 0) continue;
      const sampleRate = audio.sampling_rate ?? 24000;
      const startAt = Math.max(ctx.currentTime + 0.02, cursor);
      playBuffer(ctx, samples, sampleRate, startAt);
      cursor = startAt + samples.length / sampleRate;
      queued += 1;
    }

    if (token !== playToken) {
      options.onEnd?.();
      return;
    }

    if (queued === 0) {
      options.onEnd?.();
      return;
    }

    const remainingMs = Math.max(0, (cursor - ctx.currentTime) * 1000) + 80;
    window.setTimeout(() => {
      if (token !== playToken) return;
      stopActiveAudio();
      options.onEnd?.();
    }, remainingMs);
  } catch (error) {
    stopActiveAudio();
    logError("[WonderFact TTS] neural playback failed");
    throw error;
  }
}

import { logError } from "@/lib/safeLog";

export const DEFAULT_NEURAL_VOICE_ID = "en_US-amy-medium";
export const DEFAULT_NEURAL_SPEED = 1.08;

export interface NeuralVoiceOption {
  id: string;
  name: string;
  lang: string;
  blurb: string;
}

/** Warm English female Piper voices. Neural, not eSpeak. */
export const NEURAL_VOICE_OPTIONS: NeuralVoiceOption[] = [
  { id: "en_US-amy-medium", name: "Amy", lang: "en-US", blurb: "cheery US storyteller" },
  { id: "en_US-hfc_female-medium", name: "Holly", lang: "en-US", blurb: "warm and clear" },
  { id: "en_US-kristin-medium", name: "Kristin", lang: "en-US", blurb: "gentle reader" },
  { id: "en_GB-alba-medium", name: "Alba", lang: "en-GB", blurb: "cheery UK English" },
];

export function neuralVoiceLabel(id: string): string {
  return NEURAL_VOICE_OPTIONS.find((voice) => voice.id === id)?.name ?? "Amy";
}

interface PiperSession {
  ready: boolean;
  predict: (text: string) => Promise<Blob>;
}

interface PiperModule {
  TtsSession: {
    _instance: PiperSession | null;
    WASM_LOCATIONS: { onnxWasm: string; piperData: string; piperWasm: string };
    create: (options: {
      voiceId: string;
      progress?: (info: { url?: string; loaded?: number; total?: number }) => void;
      logger?: (text: string) => void;
      wasmPaths?: { onnxWasm: string; piperData: string; piperWasm: string };
    }) => Promise<PiperSession>;
  };
}

interface OrtWasmEnv {
  env?: {
    allowLocalModels?: boolean;
    wasm?: {
      numThreads?: number;
      proxy?: boolean;
      wasmPaths?: string;
    };
  };
}

type StatusListener = (loading: boolean, progress: number, error: string | null) => void;

let enginePromise: Promise<PiperSession> | null = null;
let engineVoiceId = "";
let loading = false;
let progress = 0;
let lastError: string | null = null;
let playToken = 0;
let unlockedContext: AudioContext | null = null;
let keepAliveSource: AudioBufferSourceNode | null = null;
let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let ortPinned = false;
const listeners = new Set<StatusListener>();

function phase(name: string): void {
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug("[WonderFact TTS] phase:", name);
  }
}

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

export function isNeuralAvailable(): boolean {
  if (!isBrowser()) return false;
  return Boolean(
    window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext,
  );
}

function getAudioContext(): AudioContext {
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error("no AudioContext");
  if (!unlockedContext || unlockedContext.state === "closed") {
    unlockedContext = new Ctor();
  }
  return unlockedContext;
}

function startKeepAlive(ctx: AudioContext): void {
  if (keepAliveSource) return;
  const buffer = ctx.createBuffer(1, Math.max(1, ctx.sampleRate), ctx.sampleRate);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  keepAliveSource = source;
}

export function unlockNeuralAudio(): void {
  if (!isBrowser()) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    startKeepAlive(ctx);
  } catch {
    /* ignore */
  }
}

function fileNameFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url, window.location.origin).pathname.split("/").pop() ?? "";
  } catch {
    return url.slice(-80);
  }
}

async function pinOnnxRuntimeToOneThread(): Promise<void> {
  if (ortPinned) return;
  const ortModule = (await import("onnxruntime-web/wasm")) as OrtWasmEnv & { default?: OrtWasmEnv };
  const ort = ortModule.default ?? ortModule;
  const wasm = ort.env?.wasm;
  if (!wasm) return;
  wasm.proxy = false;
  try {
    Object.defineProperty(wasm, "numThreads", {
      configurable: true,
      enumerable: true,
      get: () => 1,
      set: () => undefined,
    });
  } catch {
    wasm.numThreads = 1;
  }
  ortPinned = true;
}

async function loadPiperModule(): Promise<PiperModule> {
  return import("@mintplex-labs/piper-tts-web") as Promise<PiperModule>;
}

async function resetPiperSingleton(): Promise<void> {
  try {
    const { TtsSession } = await loadPiperModule();
    TtsSession._instance = null;
  } catch {
    /* ignore */
  }
}

function localWasmPaths(): { onnxWasm: string; piperData: string; piperWasm: string } {
  const origin = window.location.origin;
  return {
    onnxWasm: `${origin}/ort/`,
    piperData: `${origin}/piper/piper_phonemize.data`,
    piperWasm: `${origin}/piper/piper_phonemize.wasm`,
  };
}

async function createSession(voiceId: string): Promise<PiperSession> {
  phase("create-session");
  await pinOnnxRuntimeToOneThread();
  const { TtsSession } = await loadPiperModule();
  const wasmPaths = localWasmPaths();
  TtsSession.WASM_LOCATIONS.onnxWasm = wasmPaths.onnxWasm;
  TtsSession.WASM_LOCATIONS.piperData = wasmPaths.piperData;
  TtsSession.WASM_LOCATIONS.piperWasm = wasmPaths.piperWasm;
  return TtsSession.create({
    voiceId,
    wasmPaths,
    logger: (text) => {
      const line = String(text ?? "").slice(0, 80);
      if (line && typeof console !== "undefined" && typeof console.debug === "function") {
        console.debug("[WonderFact TTS]", line);
      }
    },
    progress: (info) => {
      const loaded = info.loaded ?? 0;
      const total = info.total ?? 0;
      if (total > 0) progress = Math.min(0.99, loaded / total);
      emit();
      const file = fileNameFromUrl(info.url);
      if (file) phase(`loading:${file.slice(0, 40)}`);
    },
  });
}

export function ensureNeuralEngine(voiceId = DEFAULT_NEURAL_VOICE_ID): Promise<PiperSession> {
  if (!isBrowser()) return Promise.reject(new Error("neural TTS is browser-only"));
  const id = NEURAL_VOICE_OPTIONS.some((item) => item.id === voiceId) ? voiceId : DEFAULT_NEURAL_VOICE_ID;
  if (enginePromise && engineVoiceId === id) return enginePromise;
  loading = true;
  progress = 0.02;
  lastError = null;
  engineVoiceId = id;
  emit();
  enginePromise = resetPiperSingleton()
    .then(() => createSession(id))
    .then((session) => {
      loading = false;
      progress = 1;
      lastError = null;
      emit();
      phase("session-ready");
      return session;
    })
    .catch(async (error) => {
      loading = false;
      lastError = "storyteller";
      enginePromise = null;
      engineVoiceId = "";
      emit();
      await resetPiperSingleton();
      const name = error instanceof Error ? error.name : "Error";
      logError("[WonderFact TTS] neural engine failed to load", { name });
      throw error;
    });
  return enginePromise;
}

export function preloadNeuralEngine(): void {
  if (!isNeuralAvailable()) return;
  void ensureNeuralEngine().catch(() => {
    /* speechSynthesis remains the fallback */
  });
}

export function stopNeuralPlayback(): void {
  playToken += 1;
  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.pause();
    activeAudio.removeAttribute("src");
    activeAudio.load();
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

export async function speakWithNeural(
  text: string,
  options: { voiceId?: string; speed?: number; onEnd?: () => void },
): Promise<void> {
  if (!isBrowser()) {
    options.onEnd?.();
    return;
  }
  stopNeuralPlayback();
  const token = playToken;
  try {
    const voiceId = options.voiceId && NEURAL_VOICE_OPTIONS.some((item) => item.id === options.voiceId)
      ? options.voiceId
      : DEFAULT_NEURAL_VOICE_ID;
    const session = await ensureNeuralEngine(voiceId);
    if (token !== playToken) {
      options.onEnd?.();
      return;
    }
    phase("predict");
    const blob = await Promise.race([
      session.predict(text),
      new Promise<Blob>((_, reject) => {
        window.setTimeout(() => reject(new Error("predict-timeout")), 45000);
      }),
    ]);
    if (token !== playToken) {
      options.onEnd?.();
      return;
    }
    phase("play");
    const rate = options.speed && Number.isFinite(options.speed) ? Math.min(1.2, Math.max(0.9, options.speed)) : 1;
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = url;
    audio.playbackRate = rate;
    activeAudio = audio;
    activeObjectUrl = url;
    let ended = false;
    const finish = () => {
      if (ended || token !== playToken) return;
      ended = true;
      phase("ended");
      if (activeAudio === audio) {
        activeAudio.onended = null;
        activeAudio.onerror = null;
        activeAudio = null;
      }
      if (activeObjectUrl === url) {
        URL.revokeObjectURL(url);
        activeObjectUrl = null;
      }
      options.onEnd?.();
    };
    audio.onended = finish;
    audio.onerror = finish;
    await Promise.race([
      audio.play(),
      new Promise<void>((_, reject) => {
        window.setTimeout(() => reject(new Error("play-timeout")), 4000);
      }),
    ]);
    if (token !== playToken) {
      finish();
      return;
    }
    phase("playing");
    const durationMs = Number.isFinite(audio.duration) ? audio.duration * 1000 / rate : 8000;
    window.setTimeout(finish, Math.min(20000, durationMs + 800));
  } catch (error) {
    stopNeuralPlayback();
    const name = error instanceof Error ? error.name : "Error";
    const msg = error instanceof Error ? error.message.slice(0, 120) : "unknown";
    logError("[WonderFact TTS] neural playback failed", { name, msg });
    throw error;
  }
}

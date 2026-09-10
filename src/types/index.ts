export const FACT_CATEGORIES = [
  "animals",
  "space",
  "nature",
  "human-body",
  "food",
] as const;

export type FactCategory = (typeof FACT_CATEGORIES)[number];

export type BrowseCategory = FactCategory | "favorites";

export type FactSource = "ai" | "fallback";

export interface Fact {
  id: string;
  category: FactCategory;
  emoji: string;
  title: string;
  fact: string;
  themeColor: string;
  source?: FactSource;
  createdAt?: string;
}

export type AiProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "xai"
  | "openrouter"
  | "gateway";

export interface ProviderConfig {
  provider: AiProviderId;
  model: string;
  /** Encrypted payload. Never log this value. */
  encryptedApiKey?: string;
  /** True when a key is stored; the raw key is never kept in the store. */
  hasKey: boolean;
}

export interface ProviderSecrets {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  xai?: string;
  openrouter?: string;
  gateway?: string;
}

export type AuthProvider =
  | "guest"
  | "google"
  | "apple"
  | "passkey"
  | "firebase"
  | "supabase";

export type ProfileMode = "kid" | "parent";

export interface KidAvatar {
  id: string;
  emoji: string;
  label: string;
}

export interface AuthUser {
  id: string;
  displayName: string;
  email?: string;
  photoUrl?: string;
  avatar: KidAvatar;
  provider: AuthProvider;
  createdAt: string;
}

export interface ParentLockState {
  pinSet: boolean;
  failedAttempts: number;
}

export interface GenerateFactRequest {
  category?: FactCategory;
  query?: string;
  recentTitles?: string[];
  provider: AiProviderId;
  model: string;
  apiKey: string;
}

export interface GenerateFactResponse {
  fact: Fact;
  usedFallback: boolean;
  warning?: string;
}

export class AiProviderError extends Error {
  readonly code:
    | "invalid_key"
    | "rate_limit"
    | "network"
    | "parse"
    | "unsafe"
    | "provider"
    | "missing_key";
  readonly status?: number;

  constructor(
    message: string,
    code: AiProviderError["code"],
    status?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
    this.code = code;
    this.status = status;
  }
}

export const KID_AVATARS: KidAvatar[] = [
  { id: "lion", emoji: "🦁", label: "Leo" },
  { id: "unicorn", emoji: "🦄", label: "Nova" },
  { id: "rocket", emoji: "🚀", label: "Zoom" },
  { id: "panda", emoji: "🐼", label: "Pip" },
  { id: "frog", emoji: "🐸", label: "Bubbles" },
  { id: "octopus", emoji: "🐙", label: "Ink" },
];

export const CATEGORY_META: Record<
  BrowseCategory,
  { label: string; emoji: string; color: string; hint: string }
> = {
  animals: {
    label: "Animals",
    emoji: "🐾",
    color: "#FFB4A2",
    hint: "Wild friends",
  },
  space: {
    label: "Space",
    emoji: "🚀",
    color: "#A5B4FC",
    hint: "Stars & planets",
  },
  nature: {
    label: "Nature",
    emoji: "🌿",
    color: "#B5E48C",
    hint: "Earth wonders",
  },
  "human-body": {
    label: "Body",
    emoji: "🧠",
    color: "#FFC6FF",
    hint: "You are amazing",
  },
  food: {
    label: "Food",
    emoji: "🍓",
    color: "#FFD6A5",
    hint: "Yummy science",
  },
  favorites: {
    label: "Saved",
    emoji: "⭐",
    color: "#FFE066",
    hint: "Your stars",
  },
};

export const PROVIDER_MODELS: Record<
  AiProviderId,
  { label: string; models: { id: string; label: string }[] }
> = {
  openai: {
    label: "OpenAI (ChatGPT)",
    models: [
      { id: "gpt-4o-mini", label: "gpt-4o-mini" },
      { id: "gpt-4.1-mini", label: "gpt-4.1-mini" },
      { id: "gpt-5-mini", label: "gpt-5-mini" },
      { id: "gpt-5.4-mini", label: "gpt-5.4-mini" },
    ],
  },
  anthropic: {
    label: "Anthropic (Claude)",
    models: [
      { id: "claude-haiku-4.5", label: "claude-haiku-4.5" },
      { id: "claude-3-haiku", label: "claude-3-haiku" },
    ],
  },
  gemini: {
    label: "Google Gemini",
    models: [
      { id: "gemini-2.5-flash", label: "gemini-2.5-flash" },
      { id: "gemini-3.5-flash", label: "gemini-3.5-flash" },
      { id: "gemini-2.0-flash", label: "gemini-2.0-flash" },
    ],
  },
  xai: {
    label: "xAI (Grok)",
    models: [
      { id: "grok-4.20-non-reasoning", label: "grok-4.20-non-reasoning" },
      { id: "grok-latest", label: "grok-latest" },
      { id: "grok-beta", label: "grok-beta" },
    ],
  },
  openrouter: {
    label: "OpenRouter",
    models: [
      { id: "openai/gpt-4o-mini", label: "openai/gpt-4o-mini" },
      { id: "anthropic/claude-haiku-4.5", label: "anthropic/claude-haiku-4.5" },
      { id: "google/gemini-2.5-flash", label: "google/gemini-2.5-flash" },
      { id: "x-ai/grok-beta", label: "x-ai/grok-beta" },
    ],
  },
  gateway: {
    label: "Vercel AI Gateway",
    models: [
      { id: "openai/gpt-4o-mini", label: "openai/gpt-4o-mini" },
      { id: "anthropic/claude-haiku-4.5", label: "anthropic-haiku-4.5" },
      { id: "google/gemini-2.5-flash", label: "google/gemini-2.5-flash" },
    ],
  },
};

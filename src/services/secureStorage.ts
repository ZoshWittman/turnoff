const PREFIX = "wonderfact.";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(PREFIX + key);
}

export const storageKeys = {
  user: "user",
  favorites: "favorites",
  secrets: "secrets",
  pinHash: "pin-hash",
  provider: "provider",
  model: "model",
  passkeys: "passkeys",
  recentTitles: "recent-titles",
  avatar: "avatar",
} as const;

import {randomBytes} from "crypto";

/** 32-symbol alphabet without 0/O/1/I to keep codes readable. */
export const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const PAIRING_CODE_LENGTH = 6;

export const PAIRING_TTL_MS = 24 * 60 * 60 * 1000;

export const REDEEM_ATTEMPT_LIMIT = 8;

export const REDEEM_WINDOW_MS = 60 * 60 * 1000;

/** Builds a cryptographically random 6-character pairing code. */
export function generatePairingCode(
  bytes: (size: number) => Buffer = randomBytes,
): string {
  const out: string[] = [];
  while (out.length < PAIRING_CODE_LENGTH) {
    const raw = bytes(16);
    for (let i = 0; i < raw.length && out.length < PAIRING_CODE_LENGTH; i++) {
      const value = raw[i];
      if (value < 256 - (256 % PAIRING_ALPHABET.length)) {
        out.push(PAIRING_ALPHABET[value % PAIRING_ALPHABET.length]);
      }
    }
  }
  return out.join("");
}

/**
 * Maps a typed character onto the pairing alphabet.
 * 0/O and 1/I are rejected because they are not in the generator alphabet;
 * callers should show a validation error rather than silently remap.
 */
export function canonicalizePairingCode(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/[\s-]/g, "");
  if (cleaned.length !== PAIRING_CODE_LENGTH) {
    return null;
  }
  let result = "";
  for (const ch of cleaned) {
    if (PAIRING_ALPHABET.includes(ch)) {
      result += ch;
      continue;
    }
    return null;
  }
  return result;
}

/** Deep-link payload encoded into the parent QR. */
export function pairingQrPayload(code: string): string {
  return `parentlock://pair?code=${encodeURIComponent(code)}`;
}

export function isExpired(expiresAtMs: number, nowMs: number): boolean {
  return nowMs >= expiresAtMs;
}

export function nextPairingExpiry(nowMs: number): number {
  return nowMs + PAIRING_TTL_MS;
}

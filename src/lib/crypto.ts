const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  arr.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromB64(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 120_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptString(plaintext: string, secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );
  return `v1.${toB64(salt)}.${toB64(iv)}.${toB64(cipher)}`;
}

export async function decryptString(payload: string, secret: string): Promise<string> {
  const [version, saltB64, ivB64, cipherB64] = payload.split(".");
  if (version !== "v1" || !saltB64 || !ivB64 || !cipherB64) {
    throw new Error("Unsupported secret payload");
  }
  const key = await deriveKey(secret, fromB64(saltB64));
  const iv = fromB64(ivB64);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    fromB64(cipherB64) as BufferSource,
  );
  return decoder.decode(plain);
}

export async function hashSecret(secret: string, saltB64?: string): Promise<string> {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 120_000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return `v1.${toB64(salt)}.${toB64(bits)}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [, saltB64] = stored.split(".");
  if (!saltB64) return false;
  const next = await hashSecret(secret, saltB64);
  return next === stored;
}

export function redactSecret(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

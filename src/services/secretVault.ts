import { encryptString, decryptString } from "@/lib/crypto";
import { readJson, writeJson, removeItem, storageKeys } from "@/services/secureStorage";
import type { AiProviderId, ProviderSecrets } from "@/types";

export async function saveProviderSecrets(
  secrets: ProviderSecrets,
  pin: string,
): Promise<void> {
  const payload = await encryptString(JSON.stringify(secrets), pin);
  writeJson(storageKeys.secrets, payload);
}

export async function loadProviderSecrets(pin: string): Promise<ProviderSecrets> {
  const payload = readJson<string | null>(storageKeys.secrets, null);
  if (!payload) return {};
  const json = await decryptString(payload, pin);
  return JSON.parse(json) as ProviderSecrets;
}

export function clearProviderSecrets(): void {
  removeItem(storageKeys.secrets);
}

export function hasStoredSecrets(): boolean {
  return Boolean(readJson<string | null>(storageKeys.secrets, null));
}

export function getSecretForProvider(
  secrets: ProviderSecrets,
  provider: AiProviderId,
): string | undefined {
  return secrets[provider];
}

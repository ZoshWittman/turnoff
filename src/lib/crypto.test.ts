import { describe, expect, it } from "vitest";
import { decryptString, encryptString, hashSecret, redactSecret, verifySecret } from "@/lib/crypto";

describe("secret encryption", () => {
  it("round-trips a provider key", async () => {
    const pin = "2468";
    const payload = await encryptString("sk-test-secret-key", pin);
    expect(payload.startsWith("v1.")).toBe(true);
    await expect(decryptString(payload, pin)).resolves.toBe("sk-test-secret-key");
    await expect(decryptString(payload, "0000")).rejects.toThrow();
  });

  it("verifies PIN hashes", async () => {
    const stored = await hashSecret("1357");
    await expect(verifySecret("1357", stored)).resolves.toBe(true);
    await expect(verifySecret("0000", stored)).resolves.toBe(false);
  });

  it("redacts secrets for display", () => {
    expect(redactSecret("sk-abcdefghij")).toBe("••••ghij");
  });
});

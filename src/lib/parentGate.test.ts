import { describe, expect, it } from "vitest";
import { checkMathAnswer, createMathChallenge, isValidPin } from "@/lib/parentGate";

describe("parent gate", () => {
  it("accepts the correct product", () => {
    const challenge = createMathChallenge();
    expect(checkMathAnswer(challenge, String(challenge.a * challenge.b))).toBe(true);
    expect(checkMathAnswer(challenge, "0")).toBe(false);
  });

  it("requires a 4-digit PIN", () => {
    expect(isValidPin("2468")).toBe(true);
    expect(isValidPin("12")).toBe(false);
    expect(isValidPin("abcd")).toBe(false);
  });
});

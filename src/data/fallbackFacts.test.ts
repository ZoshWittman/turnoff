import { describe, expect, it } from "vitest";
import { FALLBACK_FACTS } from "@/data/fallbackFacts";
import { FACT_CATEGORIES } from "@/types";
import { wordCount } from "@/lib/factSchema";

describe("fallback facts library", () => {
  it("includes 20 preloaded facts", () => {
    expect(FALLBACK_FACTS).toHaveLength(20);
  });

  it("covers every kid category", () => {
    for (const category of FACT_CATEGORIES) {
      expect(FALLBACK_FACTS.some((fact) => fact.category === category)).toBe(true);
    }
  });

  it("keeps every fact under 30 words", () => {
    for (const fact of FALLBACK_FACTS) {
      expect(wordCount(fact.fact)).toBeLessThanOrEqual(30);
      expect(fact.emoji).toBeTruthy();
      expect(fact.themeColor.startsWith("#")).toBe(true);
    }
  });
});

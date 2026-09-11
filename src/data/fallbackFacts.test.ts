import { describe, expect, it } from "vitest";
import { FALLBACK_FACTS } from "@/data/fallbackFacts";
import { CATEGORY_META, FACT_CATEGORIES } from "@/types";
import { wordCount } from "@/lib/factSchema";

const THEME_BY_CATEGORY: Record<string, string> = {
  animals: "#FFB4A2",
  space: "#A5B4FC",
  nature: "#B5E48C",
  "human-body": "#FFC6FF",
  food: "#FFD6A5",
};

describe("fallback facts library", () => {
  it("includes at least 120 preloaded facts", () => {
    expect(FALLBACK_FACTS.length).toBeGreaterThanOrEqual(120);
  });

  it("covers every kid category", () => {
    for (const category of FACT_CATEGORIES) {
      expect(FALLBACK_FACTS.some((fact) => fact.category === category)).toBe(
        true,
      );
    }
  });

  it("spreads facts across every category", () => {
    for (const category of FACT_CATEGORIES) {
      const count = FALLBACK_FACTS.filter(
        (fact) => fact.category === category,
      ).length;
      expect(count).toBeGreaterThanOrEqual(20);
    }
  });

  it("keeps every fact under 30 words", () => {
    for (const fact of FALLBACK_FACTS) {
      expect(wordCount(fact.fact)).toBeLessThanOrEqual(30);
      expect(fact.emoji).toBeTruthy();
      expect(fact.themeColor.startsWith("#")).toBe(true);
    }
  });

  it("uses unique ids, titles, and fact text", () => {
    const ids = FALLBACK_FACTS.map((fact) => fact.id);
    const titles = FALLBACK_FACTS.map((fact) => fact.title);
    const texts = FALLBACK_FACTS.map((fact) => fact.fact);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(texts).size).toBe(texts.length);

    for (const fact of FALLBACK_FACTS) {
      expect(fact.id.startsWith("fallback-")).toBe(true);
      expect(fact.source).toBe("fallback");
      expect(fact.themeColor).toBe(THEME_BY_CATEGORY[fact.category]);
      expect(fact.themeColor).toBe(CATEGORY_META[fact.category].color);
    }
  });
});

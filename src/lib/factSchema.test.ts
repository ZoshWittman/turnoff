import { describe, expect, it } from "vitest";
import { extractJsonObject, parseGeneratedFact, wordCount } from "@/lib/factSchema";

describe("fact JSON parser", () => {
  it("parses fenced JSON and clamps long facts", () => {
    const raw = `\`\`\`json
{"id":"cool-otters","category":"animals","emoji":"🦦","title":"Otter Hold Hands","fact":"Sea otters hold hands when they sleep so they do not drift apart in the ocean while they take a cozy nap together after a long day of diving.","themeColor":"#FFB4A2"}
\`\`\``;
    const fact = parseGeneratedFact(raw, "animals");
    expect(fact.title).toBe("Otter Hold Hands");
    expect(wordCount(fact.fact)).toBeLessThanOrEqual(30);
    expect(fact.source).toBe("ai");
  });

  it("rejects unsafe content", () => {
    expect(() =>
      parseGeneratedFact(
        {
          id: "bad",
          category: "animals",
          emoji: "⚠️",
          title: "Bad",
          fact: "This fact talks about a weapon in the forest.",
          themeColor: "#FFB4A2",
        },
        "animals",
      ),
    ).toThrow(/kid-safety/);
  });

  it("extracts the first JSON object", () => {
    const data = extractJsonObject('prefix {"id":"x"} trailing');
    expect(data).toEqual({ id: "x" });
  });
});

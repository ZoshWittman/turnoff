import { describe, expect, it } from "vitest";
import { pickOfflineFact } from "@/services/aiProvider";
import { FACT_CATEGORIES } from "@/types";

describe("offline AI fallback", () => {
  it("returns a fact in the requested category", () => {
    for (const category of FACT_CATEGORIES) {
      const fact = pickOfflineFact(category);
      expect(fact.category).toBe(category);
      expect(fact.source).toBe("fallback");
    }
  });
});

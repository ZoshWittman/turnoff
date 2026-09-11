import { describe, expect, it } from "vitest";
import { FALLBACK_FACTS } from "@/data/fallbackFacts";
import {
  buildTriviaFromFact,
  extractFactNumber,
  parseAiTrivia,
  triviaSpeechText,
} from "@/services/trivia";
import type { Fact } from "@/types";

const octopus: Fact = FALLBACK_FACTS.find((fact) => fact.id === "fallback-octopus-hearts")!;

describe("offline trivia generation", () => {
  it("turns a numbered fact into a fill-in-the-blank quiz", () => {
    const trivia = buildTriviaFromFact(octopus);
    expect(trivia.factId).toBe(octopus.id);
    expect(trivia.source).toBe("local");
    expect(trivia.prompt.toLowerCase()).toContain("____");
    expect(trivia.choices).toHaveLength(4);
    expect(trivia.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
    const correct = trivia.choices.find((choice) => choice.isCorrect);
    expect(correct?.label).toBe("3");
    expect(trivia.clues).toHaveLength(3);
    expect(trivia.clues[0]).toMatch(/animals/i);
    expect(trivia.answer).toBe(octopus.fact);
  });

  it("builds a true-choice quiz when the fact has no number", () => {
    const fact =
      FALLBACK_FACTS.find((item) => item.id === "fallback-honey-forever") ??
      FALLBACK_FACTS.find((item) => !extractFactNumber(item.fact))!;
    const trivia = buildTriviaFromFact(fact);
    expect(trivia.prompt).toMatch(/which one is true/i);
    expect(trivia.choices.length).toBeGreaterThanOrEqual(3);
    expect(trivia.choices.some((choice) => choice.isCorrect)).toBe(true);
    expect(trivia.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
    expect(trivia.clues.some((clue) => clue.includes(fact.title))).toBe(true);
  });

  it("creates a valid quiz for every local library fact", () => {
    for (const fact of FALLBACK_FACTS) {
      const trivia = buildTriviaFromFact(fact);
      expect(trivia.prompt.length).toBeGreaterThan(8);
      expect(trivia.choices.length).toBeGreaterThanOrEqual(3);
      expect(trivia.choices.length).toBeLessThanOrEqual(4);
      expect(trivia.choices.some((choice) => choice.isCorrect)).toBe(true);
      expect(new Set(trivia.choices.map((choice) => choice.label)).size).toBe(trivia.choices.length);
      expect(trivia.clues.length).toBeGreaterThanOrEqual(2);
      expect(trivia.answer).toBe(fact.fact);
    }
  });

  it("extracts digits and number words", () => {
    expect(extractFactNumber("Koalas nap 18 hours")?.value).toBe(18);
    expect(extractFactNumber("An octopus has three hearts")?.value).toBe(3);
    expect(extractFactNumber("Honey never spoils") ).toBeNull();
  });

  it("speaks the question, then clues, then the kind result", () => {
    const trivia = buildTriviaFromFact(octopus);
    const questionOnly = triviaSpeechText(trivia, { revealedClues: 0, status: "playing" });
    expect(questionOnly).toBe(trivia.prompt);
    expect(questionOnly).not.toContain(trivia.answer);

    const withClue = triviaSpeechText(trivia, { revealedClues: 1, status: "wrong" });
    expect(withClue).toContain(trivia.clues[0]!);
    expect(withClue).toMatch(/try another clue/i);

    const win = triviaSpeechText(trivia, { revealedClues: 2, showAnswer: true, status: "correct" });
    expect(win).toContain(trivia.celebration);
    expect(win).toContain(trivia.answer);
  });

  it("accepts optional AI trivia JSON and rejects incomplete payloads", () => {
    const parsed = parseAiTrivia(
      {
        prompt: "How many hearts does an octopus have?",
        choices: [
          { label: "One", isCorrect: false },
          { label: "Three", isCorrect: true },
          { label: "Ten", isCorrect: false },
        ],
        clues: ["It is more than one.", "The title talks about hearts."],
        answer: octopus.fact,
        celebration: "Nice catch!",
      },
      octopus,
    );
    expect(parsed?.source).toBe("ai");
    expect(parsed?.choices.some((choice) => choice.isCorrect)).toBe(true);

    expect(parseAiTrivia({ prompt: "Hi" }, octopus)).toBeNull();
  });
});

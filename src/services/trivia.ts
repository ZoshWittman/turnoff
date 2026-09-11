import { z } from "zod";
import type { Fact, FactCategory, TriviaChoice, TriviaQuestion } from "@/types";
import { CATEGORY_META } from "@/types";

export const triviaJsonSchema = z.object({
  prompt: z.string().min(8).max(180),
  choices: z
    .array(
      z.object({
        label: z.string().min(1).max(90),
        isCorrect: z.boolean(),
      }),
    )
    .min(3)
    .max(4),
  clues: z.array(z.string().min(4).max(160)).min(2).max(3),
  answer: z.string().min(4).max(280),
  celebration: z.string().min(2).max(80),
});

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  hundred: 100,
  thousand: 1000,
};

const FUNNY_WRONG: Record<FactCategory, string[]> = {
  animals: [
    "They wear tiny rain boots to bed.",
    "They all drive yellow school buses.",
    "They sneeze rainbow sprinkles.",
  ],
  space: [
    "The moon is made of frozen yogurt.",
    "Stars are little night-lights on strings.",
    "Planets hop around like popcorn.",
  ],
  nature: [
    "Rain is the sky taking a bubble bath.",
    "Clouds are made of cotton candy pillows.",
    "Rocks giggle when you tickle them.",
  ],
  "human-body": [
    "Your bones are pretzel sticks.",
    "Ears pop popcorn when you listen hard.",
    "Your brain is a tiny trampoline.",
  ],
  food: [
    "Broccoli grows on the moon.",
    "Ice cream is a kind of vegetable.",
    "Pizza trees grow in the ocean.",
  ],
};

const CELEBRATIONS = [
  "Woohoo! You got it!",
  "Star jump! That's right!",
  "Yes! Super brain power!",
  "You cracked the clue!",
];

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], seed: string): T[] {
  const next = [...items];
  const rand = mulberry32(hashSeed(seed));
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function firstSentence(text: string): string {
  const match = text.trim().match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? text).trim();
}

function secondSentence(text: string): string | undefined {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[1];
}

export function extractFactNumber(
  text: string,
): { raw: string; value: number } | null {
  const digit = text.match(/\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?/);
  if (digit) {
    return { raw: digit[0], value: Number(digit[0].replaceAll(",", "")) };
  }
  const word = text.toLowerCase().match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|hundred|thousand)\b/,
  );
  if (word) {
    const raw = word[0]!;
    return { raw, value: NUMBER_WORDS[raw] ?? 0 };
  }
  return null;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function numberDistractors(value: number): number[] {
  const extras = [
    value + 1,
    Math.max(1, value - 1),
    value === 2 ? 4 : value * 2,
    value === 3 ? 8 : 5,
    1,
    2,
    4,
    10,
    100,
  ];
  const unique = [value];
  for (const extra of extras) {
    if (unique.length >= 4) break;
    if (Number.isFinite(extra) && extra > 0 && !unique.includes(extra)) {
      unique.push(extra);
    }
  }
  return unique.slice(0, 4);
}

function toChoices(labels: string[], correctIndex: number, seed: string): TriviaChoice[] {
  const mapped = labels.map((label, index) => ({
    id: `choice-${index}`,
    label,
    isCorrect: index === correctIndex,
  }));
  return shuffle(mapped, seed).map((choice, index) => ({
    ...choice,
    id: `choice-${index + 1}`,
  }));
}

function celebrationFor(fact: Fact): string {
  const index = hashSeed(fact.id) % CELEBRATIONS.length;
  return CELEBRATIONS[index]!;
}

function buildClues(fact: Fact, extra?: string): string[] {
  const meta = CATEGORY_META[fact.category];
  const clues = [
    `Clue 1: This is a ${meta.label.toLowerCase()} wonder! Look at the ${fact.emoji}.`,
  ];
  if (extra) clues.push(`Clue 2: ${extra}`);
  else {
    const follow = secondSentence(fact.fact);
    clues.push(
      follow
        ? `Clue 2: ${follow}`
        : `Clue 2: Think about something surprising in the story.`,
    );
  }
  clues.push(`Clue 3: The title is a hint: ${fact.title}!`);
  return clues.slice(0, 3);
}

function numberTrivia(fact: Fact, number: { raw: string; value: number }): TriviaQuestion {
  const sentence = firstSentence(fact.fact);
  const blanked = sentence.replace(new RegExp(number.raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "____");
  const options = numberDistractors(number.value);
  const labels = options.map((value) =>
    Number.isInteger(value) ? formatNumber(value) : String(value),
  );
  const extra =
    number.value >= 10
      ? "The missing piece is a number you can count."
      : "The missing number is small enough to count on your fingers... maybe with a friend!";

  return {
    id: `trivia-${fact.id}`,
    factId: fact.id,
    prompt: `Fill in the blank! ${blanked}`,
    choices: toChoices(labels, 0, `${fact.id}-num`),
    clues: buildClues(fact, extra),
    answer: fact.fact,
    celebration: celebrationFor(fact),
    source: "local",
  };
}

function claimTrivia(fact: Fact): TriviaQuestion {
  const trueClaim = firstSentence(fact.fact).replace(/[.!?]+$/, ".");
  const funny = FUNNY_WRONG[fact.category];
  const labels = [trueClaim, ...funny];
  return {
    id: `trivia-${fact.id}`,
    factId: fact.id,
    prompt: `${fact.emoji} Which one is true about ${fact.title}?`,
    choices: toChoices(labels, 0, `${fact.id}-claim`),
    clues: buildClues(fact),
    answer: fact.fact,
    celebration: celebrationFor(fact),
    source: "local",
  };
}

export function buildTriviaFromFact(fact: Fact): TriviaQuestion {
  const number = extractFactNumber(fact.fact);
  if (number && number.value > 0) return numberTrivia(fact, number);
  return claimTrivia(fact);
}

export function triviaSpeechText(
  trivia: TriviaQuestion,
  options: {
    revealedClues: number;
    showAnswer?: boolean;
    status?: "playing" | "correct" | "wrong";
  },
): string {
  const parts = [trivia.prompt];
  const clues = trivia.clues.slice(0, Math.max(0, options.revealedClues));
  if (clues.length > 0) parts.push(clues.join(" "));
  if (options.status === "correct") {
    parts.push(trivia.celebration);
    parts.push(`The answer is: ${trivia.answer}`);
  } else if (options.showAnswer) {
    parts.push(`The answer is: ${trivia.answer}`);
  } else if (options.status === "wrong") {
    parts.push("Not that one. Try another clue!");
  }
  return parts.join(" ");
}

export function parseAiTrivia(
  raw: unknown,
  fact: Fact,
): TriviaQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";
  const answer = typeof data.answer === "string" ? data.answer.trim() : fact.fact;
  const celebration =
    typeof data.celebration === "string" && data.celebration.trim()
      ? data.celebration.trim()
      : celebrationFor(fact);
  const clues = Array.isArray(data.clues)
    ? data.clues.filter((item): item is string => typeof item === "string" && item.trim().length > 3).slice(0, 3)
    : [];
  const rawChoices = Array.isArray(data.choices) ? data.choices : [];
  const choices: TriviaChoice[] = rawChoices
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim() : "";
      if (!label) return null;
      return {
        id: `choice-${index + 1}`,
        label,
        isCorrect: row.isCorrect === true,
      };
    })
    .filter((item): item is TriviaChoice => item !== null);

  if (prompt.length < 8 || choices.length < 3 || !choices.some((choice) => choice.isCorrect)) {
    return null;
  }

  return {
    id: `trivia-ai-${fact.id}`,
    factId: fact.id,
    prompt,
    choices: choices.slice(0, 4),
    clues: clues.length >= 2 ? clues : buildClues(fact),
    answer: answer || fact.fact,
    celebration,
    source: "ai",
  };
}

export async function loadTriviaForFact(
  fact: Fact,
  options?: {
    apiKey?: string;
    provider?: string;
    model?: string;
  },
): Promise<TriviaQuestion> {
  const local = buildTriviaFromFact(fact);
  const apiKey = options?.apiKey?.trim();
  if (!apiKey) return local;

  try {
    const response = await fetch("/api/trivia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fact,
        provider: options?.provider,
        model: options?.model,
        apiKey,
      }),
    });
    if (!response.ok) return local;
    const payload = (await response.json()) as { trivia?: unknown };
    return parseAiTrivia(payload.trivia, fact) ?? local;
  } catch {
    return local;
  }
}

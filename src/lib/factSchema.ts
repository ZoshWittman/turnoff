import { z } from "zod";
import {
  FACT_CATEGORIES,
  type Fact,
  type FactCategory,
} from "@/types";

export const MAX_FACT_WORDS = 30;

export const factJsonSchema = z.object({
  id: z.string().min(1).max(80),
  category: z.enum(FACT_CATEGORIES),
  emoji: z.string().min(1).max(8),
  title: z.string().min(2).max(48),
  fact: z.string().min(8).max(280),
  themeColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/, "themeColor must be a hex color"),
});

export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function clampFactWords(text: string, max = MAX_FACT_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(" ");
  return `${words.slice(0, max).join(" ")}`;
}

const UNSAFE =
  /\b(kill|murder|suicide|blood|weapon|sex|porn|hate|drug|gun|war|terror)\b/i;

export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export function parseGeneratedFact(
  raw: unknown,
  fallbackCategory: FactCategory,
): Fact {
  const data = typeof raw === "string" ? extractJsonObject(raw) : raw;
  const parsed = factJsonSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Fact JSON failed validation");
  }
  if (UNSAFE.test(`${parsed.data.title} ${parsed.data.fact}`)) {
    throw new Error("Fact failed the kid-safety filter");
  }
  const fact = clampFactWords(parsed.data.fact);
  if (wordCount(fact) === 0) {
    throw new Error("Fact text was empty");
  }
  return {
    ...parsed.data,
    category: parsed.data.category || fallbackCategory,
    fact,
    source: "ai",
    createdAt: new Date().toISOString(),
  };
}

export function buildKidFactPrompt(options: {
  category?: FactCategory;
  query?: string;
  recentTitles?: string[];
}): string {
  const category = options.category ?? "animals";
  const query = options.query?.trim();
  const recent = (options.recentTitles ?? []).slice(0, 8).join("; ");

  return [
    "You are WonderFact, a cheerful science teacher for children ages 5 to 10.",
    "Write ONE brand-new fun trivia fact.",
    "Hard rules:",
    "- Safe, kind, and age-appropriate for ages 5-10.",
    "- No violence, fear, romance, politics, death, or adult topics.",
    "- The fact field MUST be under 30 words.",
    "- True, high-interest, and easy for a 7-year-old to enjoy.",
    "- Reply with JSON only. No markdown, no extra keys.",
    "JSON shape:",
    '{"id":"short-unique-slug","category":"animals|space|nature|human-body|food","emoji":"one emoji","title":"3-6 word title","fact":"under 30 words","themeColor":"#pastelhex"}',
    `Category: ${category}`,
    query
      ? `Kid request: ${query}. Stay inside the selected category when possible.`
      : "Pick something surprising and delightful in this category.",
    recent ? `Do not repeat these titles: ${recent}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import { randomFallbackFact } from "@/data/fallbackFacts";
import { buildKidFactPrompt, factJsonSchema, parseGeneratedFact } from "@/lib/factSchema";
import { logError } from "@/lib/safeLog";
import {
  AiProviderError,
  type AiProviderId,
  type Fact,
  type FactCategory,
  type GenerateFactRequest,
  type GenerateFactResponse,
} from "@/types";

function classifyProviderError(error: unknown): AiProviderError {
  const message = error instanceof Error ? error.message : "Unknown provider error";
  const status =
    typeof error === "object" && error && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode)
      : undefined;
  const lower = message.toLowerCase();
  if (status === 401 || status === 403 || /invalid api key|incorrect api key|unauthorized|permission/i.test(lower)) {
    return new AiProviderError(
      "That API key does not look valid. Double-check it in Parent Settings.",
      "invalid_key",
      status,
    );
  }
  if (status === 429 || /rate limit|too many requests/i.test(lower)) {
    return new AiProviderError(
      "The AI helper needs a short rest. Try again in a moment.",
      "rate_limit",
      status,
    );
  }
  if (/network|fetch|timeout|econn/i.test(lower)) {
    return new AiProviderError(
      "We could not reach the AI helper. Check the internet connection.",
      "network",
      status,
    );
  }
  return new AiProviderError(message, "provider", status);
}

function languageModel(request: GenerateFactRequest) {
  const { provider, model, apiKey } = request;
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "gemini":
      return createGoogle({ apiKey })(model);
    case "xai":
      return createXai({ apiKey })(model);
    case "openrouter":
      return createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        name: "openrouter",
        headers: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          "X-Title": "WonderFact Kids",
        },
      })(model);
    case "gateway":
      return createOpenAI({
        apiKey,
        baseURL: "https://ai-gateway.vercel.sh/v1",
        name: "gateway",
      })(model);
    default:
      throw new AiProviderError("Unknown AI provider", "provider");
  }
}

export async function generateKidFact(
  request: GenerateFactRequest,
  options: { allowFallback?: boolean } = {},
): Promise<GenerateFactResponse> {
  const allowFallback = options.allowFallback ?? true;
  const category: FactCategory = request.category ?? "animals";
  if (!request.apiKey?.trim()) {
    if (!allowFallback) {
      throw new AiProviderError("Add an API key in Parent Settings first.", "missing_key");
    }
    return {
      fact: randomFallbackFact(category),
      usedFallback: true,
      warning: "No API key is set, so we used a built-in WonderFact.",
    };
  }

  try {
    const { output } = await generateText({
      model: languageModel(request),
      output: Output.object({
        schema: factJsonSchema,
      }),
      prompt: buildKidFactPrompt({
        category,
        query: request.query,
        recentTitles: request.recentTitles,
      }),
      maxOutputTokens: 220,
      maxRetries: 1,
    });

    const fact = parseGeneratedFact(output, category);
    return { fact, usedFallback: false };
  } catch (error) {
    logError("AI generation failed; using fallback", {
      provider: request.provider,
      model: request.model,
      error: error instanceof Error ? error.message : "unknown",
    });
    const classified =
      error instanceof AiProviderError ? error : classifyProviderError(error);
    if (!allowFallback) throw classified;
    return {
      fact: randomFallbackFact(category, request.recentTitles),
      usedFallback: true,
      warning: classified.message,
    };
  }
}

export async function requestKidFact(input: {
  category?: FactCategory;
  query?: string;
  recentTitles?: string[];
  provider: AiProviderId;
  model: string;
  apiKey?: string;
}): Promise<GenerateFactResponse> {
  if (!input.apiKey) {
    return {
      fact: randomFallbackFact(input.category),
      usedFallback: true,
      warning: "Grown-ups can add an AI key in Parent Settings for brand-new facts.",
    };
  }

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: input.category,
      query: input.query,
      recentTitles: input.recentTitles,
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey,
    }),
  });

  const payload = (await response.json()) as GenerateFactResponse & { error?: string };
  if (!response.ok && !payload.fact) {
    throw new AiProviderError(
      payload.error ?? "Could not create a new fact.",
      response.status === 401 ? "invalid_key" : "provider",
      response.status,
    );
  }
  return payload;
}

export function pickOfflineFact(category?: FactCategory, recentIds: string[] = []): Fact {
  return randomFallbackFact(category, recentIds);
}

import { generateKidFact } from "@/services/aiProvider";
import { logError } from "@/lib/safeLog";
import { AiProviderError, FACT_CATEGORIES, type AiProviderId } from "@/types";

export const maxDuration = 30;

const PROVIDERS: AiProviderId[] = [
  "openai",
  "anthropic",
  "gemini",
  "xai",
  "openrouter",
  "gateway",
];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      category?: string;
      query?: string;
      recentTitles?: string[];
      provider?: AiProviderId;
      model?: string;
      apiKey?: string;
      test?: boolean;
    };

    const provider = PROVIDERS.includes(body.provider as AiProviderId)
      ? (body.provider as AiProviderId)
      : "openai";
    const category = FACT_CATEGORIES.includes(body.category as never)
      ? (body.category as (typeof FACT_CATEGORIES)[number])
      : "animals";

    const result = await generateKidFact(
      {
        category,
        query: typeof body.query === "string" ? body.query.slice(0, 120) : undefined,
        recentTitles: Array.isArray(body.recentTitles) ? body.recentTitles.slice(0, 12) : [],
        provider,
        model: body.model || "gpt-4o-mini",
        apiKey: body.apiKey ?? "",
      },
      { allowFallback: body.test !== true },
    );

    return Response.json(result);
  } catch (error) {
    logError("Generate route failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    const status = error instanceof AiProviderError && error.code === "invalid_key" ? 401 : 400;
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create a WonderFact right now.",
        usedFallback: true,
      },
      { status },
    );
  }
}

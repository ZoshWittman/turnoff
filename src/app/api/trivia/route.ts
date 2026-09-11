import { generateKidTrivia } from "@/services/aiProvider";
import { logError } from "@/lib/safeLog";
import { AiProviderError, type AiProviderId, type Fact } from "@/types";

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
      fact?: Fact;
      provider?: AiProviderId;
      model?: string;
      apiKey?: string;
    };

    if (!body.fact?.id || !body.fact.fact || !body.apiKey?.trim()) {
      return Response.json({ trivia: null }, { status: 200 });
    }

    const provider = PROVIDERS.includes(body.provider as AiProviderId)
      ? (body.provider as AiProviderId)
      : "openai";

    const trivia = await generateKidTrivia({
      fact: body.fact,
      provider,
      model: body.model || "gpt-4o-mini",
      apiKey: body.apiKey,
    });

    return Response.json({ trivia });
  } catch (error) {
    logError("Trivia route failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    const status = error instanceof AiProviderError && error.code === "invalid_key" ? 401 : 200;
    return Response.json({ trivia: null }, { status });
  }
}

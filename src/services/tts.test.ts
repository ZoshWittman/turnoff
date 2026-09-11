import { describe, expect, it } from "vitest";
import {
  kidVoiceProfile,
  pickKidFriendlyVoice,
  rankVoices,
  scoreVoice,
  type RankableVoice,
} from "@/services/tts";

function voice(partial: Partial<RankableVoice> & Pick<RankableVoice, "name" | "lang">): RankableVoice {
  return { localService: true, default: false, ...partial };
}

describe("kid-friendly TTS voice ranking", () => {
  const catalog: RankableVoice[] = [
    voice({ name: "Microsoft David Desktop", lang: "en-US" }),
    voice({ name: "Google Deutsch", lang: "de-DE" }),
    voice({ name: "Google US English", lang: "en-US" }),
    voice({ name: "Microsoft Zira Desktop", lang: "en-US" }),
    voice({ name: "Samantha", lang: "en-US" }),
    voice({ name: "Karen", lang: "en-AU" }),
    voice({ name: "Fred", lang: "en-US" }),
    voice({ name: "Google español", lang: "es-ES" }),
    voice({ name: "Microsoft Mark", lang: "en-US", localService: false }),
    voice({ name: "child girl high", lang: "en-US" }),
  ];

  it("scores English child-like and known cheery voices highest", () => {
    expect(scoreVoice(voice({ name: "child girl high", lang: "en-US" }))).toBeGreaterThan(
      scoreVoice(voice({ name: "Microsoft David Desktop", lang: "en-US" })),
    );
    expect(scoreVoice(voice({ name: "Samantha", lang: "en-US" }))).toBeGreaterThan(
      scoreVoice(voice({ name: "Fred", lang: "en-US" })),
    );
    expect(scoreVoice(voice({ name: "Microsoft Zira Desktop", lang: "en-US" }))).toBeGreaterThan(
      scoreVoice(voice({ name: "Google Deutsch", lang: "de-DE" })),
    );
  });

  it("picks the best available English voice from a mixed catalog", () => {
    const best = pickKidFriendlyVoice(catalog);
    expect(best?.name).toBe("child girl high");
    const withoutChild = catalog.filter((item) => item.name !== "child girl high");
    expect(pickKidFriendlyVoice(withoutChild)?.name).toBe("Samantha");
  });

  it("ranks Google US English and Zira ahead of male defaults", () => {
    const ranked = rankVoices([
      voice({ name: "Microsoft David Desktop", lang: "en-US" }),
      voice({ name: "Google US English", lang: "en-US" }),
      voice({ name: "Microsoft Zira Desktop", lang: "en-US" }),
    ]);
    expect(ranked[0]?.name).toMatch(/Zira|Google US English/);
    expect(ranked.at(-1)?.name).toBe("Microsoft David Desktop");
  });

  it("applies a child-like pitch and rate profile", () => {
    const female = kidVoiceProfile(voice({ name: "Samantha", lang: "en-US" }));
    expect(female.pitch).toBeGreaterThanOrEqual(1.2);
    expect(female.pitch).toBeLessThanOrEqual(1.45);
    expect(female.rate).toBeGreaterThanOrEqual(0.9);
    expect(female.rate).toBeLessThanOrEqual(1.05);
    expect(female.lang.toLowerCase()).toMatch(/^en/);

    const male = kidVoiceProfile(voice({ name: "Microsoft David Desktop", lang: "en-US" }));
    expect(male.pitch).toBeGreaterThan(female.pitch);
    expect(male.pitch).toBeLessThanOrEqual(1.45);
  });

  it("falls back when no voices are listed", () => {
    expect(pickKidFriendlyVoice([])).toBeUndefined();
    const profile = kidVoiceProfile();
    expect(profile.lang).toBe("en-US");
    expect(profile.pitch).toBeGreaterThanOrEqual(1.2);
  });
});

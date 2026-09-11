import { describe, expect, it } from "vitest";
import {
  isQualityNativeVoice,
  isRoboticVoice,
  kidVoiceProfile,
  listSpeakableVoices,
  pickKidFriendlyVoice,
  rankVoices,
  resolveVoicePlan,
  scoreVoice,
  type RankableVoice,
} from "@/services/tts";
import { cheerifySpokenText } from "@/services/spokenText";

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
    voice({ name: "eSpeak NG", lang: "en-US" }),
    voice({ name: "English (America) compact", lang: "en-US" }),
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

  it("ranks Google UK English Female and Zira ahead of male defaults", () => {
    const ranked = rankVoices([
      voice({ name: "Microsoft David Desktop", lang: "en-US" }),
      voice({ name: "Google UK English Female", lang: "en-GB" }),
      voice({ name: "Microsoft Zira Desktop", lang: "en-US" }),
    ]);
    expect(ranked[0]?.name).toMatch(/Zira|Google UK English Female/);
    expect(ranked.at(-1)?.name).toBe("Microsoft David Desktop");
  });

  it("applies a cheery higher pitch and livelier rate profile", () => {
    const female = kidVoiceProfile(voice({ name: "Samantha", lang: "en-US" }));
    expect(female.pitch).toBeGreaterThanOrEqual(1.22);
    expect(female.pitch).toBeLessThanOrEqual(1.5);
    expect(female.rate).toBeGreaterThanOrEqual(1.0);
    expect(female.rate).toBeLessThanOrEqual(1.16);
    expect(female.lang.toLowerCase()).toMatch(/^en/);

    const male = kidVoiceProfile(voice({ name: "Microsoft David Desktop", lang: "en-US" }));
    expect(male.pitch).toBeGreaterThan(female.pitch);
    expect(male.pitch).toBeLessThanOrEqual(1.5);
  });

  it("falls back when no voices are listed", () => {
    expect(pickKidFriendlyVoice([])).toBeUndefined();
    const profile = kidVoiceProfile();
    expect(profile.lang).toBe("en-US");
    expect(profile.pitch).toBeGreaterThanOrEqual(1.22);
    expect(profile.rate).toBeGreaterThanOrEqual(1.0);
  });

  it("flags eSpeak, compact, dummy, and David as robotic", () => {
    expect(isRoboticVoice(voice({ name: "eSpeak NG", lang: "en-US" }))).toBe(true);
    expect(isRoboticVoice(voice({ name: "English (America) compact", lang: "en-US" }))).toBe(true);
    expect(isRoboticVoice(voice({ name: "Google US English", lang: "en-US" }))).toBe(true);
    expect(isRoboticVoice(voice({ name: "Microsoft David Desktop", lang: "en-US" }))).toBe(true);
    expect(isRoboticVoice(voice({ name: "Samantha", lang: "en-US" }))).toBe(false);
    expect(isRoboticVoice(voice({ name: "Google UK English Female", lang: "en-GB" }))).toBe(false);
  });

  it("treats Samantha, Karen, Zira, and neural voices as quality native", () => {
    expect(isQualityNativeVoice(voice({ name: "Samantha", lang: "en-US" }))).toBe(true);
    expect(isQualityNativeVoice(voice({ name: "Karen", lang: "en-AU" }))).toBe(true);
    expect(isQualityNativeVoice(voice({ name: "Microsoft Zira Desktop", lang: "en-US" }))).toBe(true);
    expect(isQualityNativeVoice(voice({ name: "Google UK English Female", lang: "en-GB" }))).toBe(true);
    expect(isQualityNativeVoice(voice({ name: "eSpeak NG", lang: "en-US" }))).toBe(false);
    expect(isQualityNativeVoice(voice({ name: "Google US English", lang: "en-US" }))).toBe(false);
  });
});

describe("voice plan chooses neural when browser voices are robotic", () => {
  it("defaults to Kokoro Bella when there are no browser voices", () => {
    const plan = resolveVoicePlan([]);
    expect(plan.engine).toBe("neural");
    expect(plan.voiceId).toBe("neural:af_bella");
    expect(plan.displayName).toBe("Bella");
  });

  it("defaults to neural when only eSpeak or compact voices exist", () => {
    const plan = resolveVoicePlan([
      voice({ name: "eSpeak NG", lang: "en-US", default: true }),
      voice({ name: "English (America) compact", lang: "en-US" }),
      voice({ name: "Microsoft David Desktop", lang: "en-US" }),
    ]);
    expect(plan.engine).toBe("neural");
    expect(plan.displayName).toBe("Bella");
    expect(plan.reason).toMatch(/robotic|no-browser/);
  });

  it("keeps Samantha as the browser voice when a quality native voice exists", () => {
    const plan = resolveVoicePlan([
      voice({ name: "Microsoft David Desktop", lang: "en-US" }),
      voice({ name: "Samantha", lang: "en-US" }),
    ]);
    expect(plan.engine).toBe("browser");
    expect(plan.displayName).toBe("Samantha");
  });

  it("honors a parent neural pick even when Samantha exists", () => {
    const plan = resolveVoicePlan(
      [voice({ name: "Samantha", lang: "en-US" })],
      "neural:af_sky",
    );
    expect(plan.engine).toBe("neural");
    expect(plan.displayName).toBe("Sky");
  });

  it("lists auto, neural storytellers, then browser voices", () => {
    const choices = listSpeakableVoices([voice({ name: "Samantha", lang: "en-US" })]);
    expect(choices[0]?.id).toBe("auto");
    expect(choices.some((item) => item.id === "neural:af_bella")).toBe(true);
    expect(choices.some((item) => item.id === "browser:Samantha")).toBe(true);
  });
});

describe("spoken energy rewrite", () => {
  it("adds a wow without changing already-excited lines", () => {
    expect(cheerifySpokenText("Otters hold hands when they sleep.")).toMatch(/^Wow! /);
    expect(cheerifySpokenText("Wow! Otters hold hands.")).toBe("Wow! Otters hold hands.");
    expect(cheerifySpokenText("Clue 1: Look at the emoji.")).toMatch(/^Ooh! /);
  });
});

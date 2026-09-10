const DEFAULT_RATE = 0.9;
const DEFAULT_PITCH = 1.15;

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const friendly = voices.find(
    (voice) =>
      /samantha|karen|google us english|female|child|siri/i.test(voice.name) &&
      voice.lang.toLowerCase().startsWith("en"),
  );
  return friendly ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
}

export function speakFact(text: string, onEnd?: () => void): void {
  if (!isSpeechSupported()) {
    onEnd?.();
    return;
  }
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = DEFAULT_RATE;
  utterance.pitch = DEFAULT_PITCH;
  utterance.lang = "en-US";
  const voices = window.speechSynthesis.getVoices();
  const voice = pickVoice(voices);
  if (voice) utterance.voice = voice;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export function preloadVoices(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.getVoices();
}

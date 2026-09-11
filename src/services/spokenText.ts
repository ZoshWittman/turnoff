/** Light spoken-only energy. Never used to change the on-screen fact. */
export function cheerifySpokenText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (/^(wow|woohoo|ooh|hey|yes!|quiz time|here'?s a clue)\b/i.test(trimmed)) {
    return trimmed;
  }
  if (/^clue\b/i.test(trimmed) || (trimmed.length < 28 && !/[.!?]$/.test(trimmed))) {
    return `Ooh! ${trimmed}`;
  }
  return `Wow! ${trimmed}`;
}

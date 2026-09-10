export interface MathChallenge {
  prompt: string;
  answer: number;
  a: number;
  b: number;
}

export function createMathChallenge(): MathChallenge {
  const a = 6 + Math.floor(Math.random() * 7); // 6-12
  const b = 6 + Math.floor(Math.random() * 7);
  return {
    a,
    b,
    prompt: `Solve ${a} × ${b} to enter Parent Settings`,
    answer: a * b,
  };
}

export function checkMathAnswer(challenge: MathChallenge, value: string): boolean {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed === challenge.answer;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

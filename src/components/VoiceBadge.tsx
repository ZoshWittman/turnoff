"use client";

interface VoiceBadgeProps {
  name: string;
  loading?: boolean;
  progress?: number;
  engine?: "neural" | "browser" | "none";
}

export function VoiceBadge({ name, loading, progress = 0, engine }: VoiceBadgeProps) {
  const pct = Math.round(progress * 100);
  const label = loading
    ? `Waking up ${name || "the storyteller"}…${pct > 2 && pct < 100 ? ` ${pct}%` : ""}`
    : engine === "neural"
      ? `🎤 ${name} · storyteller`
      : `🎤 ${name}`;

  return (
    <p className="text-center text-sm font-extrabold text-violet-700" aria-live="polite">
      {label}
    </p>
  );
}

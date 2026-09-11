"use client";

interface VoiceBadgeProps {
  name: string;
  loading?: boolean;
  engine?: "neural" | "browser" | "none";
}

export function VoiceBadge({ name, loading, engine }: VoiceBadgeProps) {
  const label = loading
    ? `Waking up ${name || "the storyteller"}…`
    : engine === "neural"
      ? `🎤 ${name} · storyteller`
      : `🎤 ${name}`;

  return (
    <p className="text-center text-sm font-extrabold text-violet-700" aria-live="polite">
      {label}
    </p>
  );
}

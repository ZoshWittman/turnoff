"use client";

import { BookOpen, Gamepad2 } from "lucide-react";
import type { KidPlayMode } from "@/game/types";

export function ModeSwitch({
  value,
  onChange,
}: {
  value: KidPlayMode;
  onChange: (mode: KidPlayMode) => void;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-2 rounded-[1.6rem] bg-white/80 p-2"
      role="tablist"
      aria-label="Play mode"
    >
      <button
        type="button"
        role="tab"
        data-testid="mode-explore"
        aria-selected={value === "explore"}
        className={`wf-btn min-h-[3.1rem] text-base ${
          value === "explore" ? "bg-violet-300 text-violet-950" : "bg-white text-violet-800"
        }`}
        onClick={() => onChange("explore")}
      >
        <BookOpen size={22} />
        Explore
      </button>
      <button
        type="button"
        role="tab"
        data-testid="mode-game"
        aria-selected={value === "game"}
        className={`wf-btn min-h-[3.1rem] text-base ${
          value === "game" ? "bg-lime-300 text-violet-950" : "bg-white text-violet-800"
        }`}
        onClick={() => onChange("game")}
      >
        <Gamepad2 size={22} />
        Game
      </button>
    </div>
  );
}

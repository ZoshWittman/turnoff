"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import type { Direction } from "@/game/types";

const KEYS: { dir: Direction; testId: string; label: string; Icon: typeof ArrowUp; extra?: string }[] = [
  { dir: "up", testId: "dpad-up", label: "Up", Icon: ArrowUp, extra: "col-start-2" },
  { dir: "left", testId: "dpad-left", label: "Left", Icon: ArrowLeft, extra: "col-start-1" },
  { dir: "right", testId: "dpad-right", label: "Right", Icon: ArrowRight, extra: "col-start-3" },
  { dir: "down", testId: "dpad-down", label: "Down", Icon: ArrowDown, extra: "col-start-2" },
];

export function DPad({
  onSteer,
  disabled,
}: {
  onSteer: (dir: Direction) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="mx-auto grid w-full max-w-[16rem] grid-cols-3 grid-rows-3 gap-2"
      aria-label="Move"
    >
      {KEYS.map(({ dir, testId, label, Icon, extra }) => (
        <button
          key={dir}
          type="button"
          data-testid={testId}
          aria-label={label}
          disabled={disabled}
          className={`wf-btn h-16 min-h-16 bg-white text-violet-900 ${extra ?? ""} ${
            dir === "left" || dir === "right" ? "row-start-2" : ""
          } ${dir === "down" ? "row-start-3" : ""}`}
          onPointerDown={(event) => {
            event.preventDefault();
            onSteer(dir);
          }}
        >
          <Icon size={28} />
        </button>
      ))}
    </div>
  );
}

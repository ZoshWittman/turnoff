"use client";

import { CATEGORY_META, FACT_CATEGORIES, type BrowseCategory } from "@/types";

const TABS: BrowseCategory[] = [...FACT_CATEGORIES, "favorites"];

export function CategoryBar({
  value,
  onChange,
}: {
  value: BrowseCategory;
  onChange: (category: BrowseCategory) => void;
}) {
  return (
    <nav aria-label="Fact categories" className="flex gap-2 overflow-x-auto pb-2 pt-1">
      {TABS.map((category) => {
        const meta = CATEGORY_META[category];
        const active = value === category;
        return (
          <button
            key={category}
            type="button"
            onClick={() => onChange(category)}
            className={`flex min-w-[7.5rem] flex-col items-center rounded-3xl border-4 px-3 py-3 text-base font-bold shadow-[0_6px_0_rgba(80,40,90,0.12)] ${
              active
                ? "border-violet-800 bg-white text-violet-950"
                : "border-transparent bg-white/60 text-violet-800"
            }`}
            aria-pressed={active}
          >
            <span className="text-3xl" aria-hidden>
              {meta.emoji}
            </span>
            {meta.label}
          </button>
        );
      })}
    </nav>
  );
}

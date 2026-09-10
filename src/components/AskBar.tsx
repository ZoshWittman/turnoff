"use client";

const SUGGESTIONS = ["Dinosaurs", "Sharks", "Planets", "Rainbows", "Pizza"];

export function AskBar({
  value,
  onChange,
  onAsk,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onAsk: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="rounded-[1.8rem] bg-white/80 p-4 shadow-sm">
      <label htmlFor="kid-query" className="mb-2 block text-lg font-bold text-violet-900">
        Tell me a cool fact about…
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="kid-query"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onAsk();
          }}
          className="wf-input"
          placeholder="Dinosaurs!"
          maxLength={80}
        />
        <button
          type="button"
          className="wf-btn bg-fuchsia-300 text-violet-950"
          onClick={onAsk}
          disabled={disabled}
        >
          Ask!
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((item) => (
          <button
            key={item}
            type="button"
            className="rounded-full bg-violet-100 px-3 py-2 font-bold text-violet-800"
            onClick={() => {
              onChange(item);
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}

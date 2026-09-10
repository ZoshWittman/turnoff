"use client";

export default function ErrorState({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-6xl">🎈</div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-violet-950">
        Oops! That balloon popped.
      </h1>
      <p className="text-lg text-violet-800">Let&apos;s try that screen again.</p>
      <button type="button" className="wf-btn bg-amber-300 text-violet-950" onClick={reset}>
        Try again
      </button>
    </div>
  );
}

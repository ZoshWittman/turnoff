"use client";

import { KID_AVATARS } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

export function AuthScreen() {
  const { continueAsGuest, setAvatar, signInGoogle, signInApple, user, authFeatures } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [avatar, setLocalAvatar] = useState(user?.avatar ?? KID_AVATARS[0]!);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <div className="text-7xl" aria-hidden>
        🌈
      </div>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-violet-950 sm:text-5xl">
        WonderFact Kids
      </h1>
      <p className="mt-2 text-xl text-violet-800">Fun facts for ages 5 to 10. Pick a buddy and start exploring!</p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {KID_AVATARS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setLocalAvatar(item);
              setAvatar(item);
            }}
            className={`rounded-3xl border-4 p-3 text-4xl ${
              avatar.id === item.id ? "border-violet-800 bg-white" : "border-transparent bg-white/50"
            }`}
            aria-label={item.label}
          >
            {item.emoji}
            <div className="mt-1 text-sm font-bold text-violet-800">{item.label}</div>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="wf-btn mt-6 w-full bg-amber-300 text-violet-950"
        onClick={() => continueAsGuest(avatar)}
      >
        Let&apos;s Go!
      </button>

      <div className="mt-4 grid w-full gap-2">
        <button
          type="button"
          className="wf-btn w-full bg-white text-violet-950"
          onClick={() => {
            setError(null);
            void signInGoogle().catch((err: Error) => setError(err.message));
          }}
        >
          Continue with Google
        </button>
        <button
          type="button"
          className="wf-btn w-full bg-black text-white"
          onClick={() => {
            setError(null);
            void signInApple().catch((err: Error) => setError(err.message));
          }}
        >
          Continue with Apple
        </button>
      </div>
      {!authFeatures.google && !authFeatures.apple && (
        <p className="mt-3 text-sm text-violet-600">
          Google and Apple work after a parent adds login settings. You can explore right now as a guest.
        </p>
      )}
      {error && <p className="mt-3 rounded-2xl bg-rose-100 p-3 font-bold text-rose-700">{error}</p>}
    </div>
  );
}

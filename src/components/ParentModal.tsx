"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { checkMathAnswer, createMathChallenge, isValidPin } from "@/lib/parentGate";
import { redactSecret } from "@/lib/crypto";
import {
  clearProviderSecrets,
  getSecretForProvider,
  hasStoredSecrets,
  loadProviderSecrets,
  saveProviderSecrets,
} from "@/services/secretVault";
import { useAppStore } from "@/store/useAppStore";
import {
  PROVIDER_MODELS,
  type AiProviderId,
  type ProviderSecrets,
} from "@/types";

interface ParentModalProps {
  onClose: () => void;
}

type GateStep = "math" | "pin" | "dashboard";

const PROVIDER_ORDER: AiProviderId[] = [
  "openai",
  "anthropic",
  "gemini",
  "xai",
  "openrouter",
  "gateway",
];

export function ParentModal({ onClose }: ParentModalProps) {
  const {
    pinSet,
    setParentPin,
    verifyParentPin,
    resetParentLock,
    enterKidMode,
    signInGoogle,
    signInApple,
    registerDevicePasskey,
    unlockWithPasskey,
    signOut,
    user,
    authFeatures,
    setSessionSecrets,
  } = useAuth();
  const { provider, model, setProvider } = useAppStore();

  const [step, setStep] = useState<GateStep>("math");
  const [challenge, setChallenge] = useState(() => createMathChallenge());
  const [mathValue, setMathValue] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [unlockedPin, setUnlockedPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [draftKeys, setDraftKeys] = useState<ProviderSecrets>({});
  const [testing, setTesting] = useState(false);
  const [customModel, setCustomModel] = useState(model);

  const models = useMemo(() => PROVIDER_MODELS[provider].models, [provider]);

  async function openDashboard(secretPin: string) {
    try {
      const secrets = await loadProviderSecrets(secretPin);
      setDraftKeys(secrets);
      setSessionSecrets(secrets);
    } catch {
      setDraftKeys({});
    }
    setUnlockedPin(secretPin);
    setStep("dashboard");
    setError(null);
  }

  function submitMath() {
    if (!checkMathAnswer(challenge, mathValue)) {
      setError("Not quite! Try the math puzzle again.");
      setChallenge(createMathChallenge());
      setMathValue("");
      return;
    }
    setError(null);
    setStep("pin");
  }

  async function submitPin() {
    if (pinSet) {
      const ok = await verifyParentPin(pin);
      if (!ok) {
        setError("That PIN did not match. Try again or reset the lock.");
        return;
      }
      await openDashboard(pin);
      return;
    }
    if (!isValidPin(pin) || pin !== pinConfirm) {
      setError("Choose a 4-digit PIN and type it twice.");
      return;
    }
    await setParentPin(pin);
    await openDashboard(pin);
  }

  async function saveKeys() {
    if (!unlockedPin) return;
    await saveProviderSecrets(draftKeys, unlockedPin);
    setSessionSecrets(draftKeys);
    setStatus("Keys saved in encrypted storage on this device.");
  }

  async function testConnection() {
    const apiKey = getSecretForProvider(draftKeys, provider);
    if (!apiKey) {
      setError("Paste an API key for the selected provider first.");
      return;
    }
    setTesting(true);
    setError(null);
    try {
      const result = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "animals",
          query: "A tiny test fact about otters",
          provider,
          model: customModel || model,
          apiKey,
          test: true,
        }),
      });
      const payload = await result.json();
      if (!result.ok || payload.usedFallback) {
        throw new Error(payload.error || payload.warning || "Key test failed");
      }
      setStatus("Success! New WonderFacts can be created on the fly.");
      setProvider(provider, customModel || model);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not test that key.");
    } finally {
      setTesting(false);
    }
  }

  function close() {
    enterKidMode();
    onClose();
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center bg-violet-950/50 p-3 sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="parent-title"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-[#fffaf3] p-5 shadow-2xl sm:p-8"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-violet-500">
                Grown-ups only
              </p>
              <h2 id="parent-title" className="font-[family-name:var(--font-display)] text-3xl text-violet-950">
                Parent Dashboard
              </h2>
            </div>
            <button type="button" className="wf-icon-btn" onClick={close} aria-label="Close">
              <X />
            </button>
          </div>

          {step === "math" && (
            <div className="space-y-4">
              <div className="rounded-3xl bg-violet-100 p-5 text-center">
                <Lock className="mx-auto mb-2 text-violet-700" />
                <p className="text-2xl font-bold text-violet-950">{challenge.prompt}</p>
              </div>
              <input
                inputMode="numeric"
                value={mathValue}
                onChange={(event) => setMathValue(event.target.value)}
                className="wf-input text-center text-3xl"
                placeholder="Your answer"
                aria-label="Math answer"
              />
              <button type="button" className="wf-btn w-full bg-violet-600 text-white" onClick={submitMath}>
                Unlock
              </button>
            </div>
          )}

          {step === "pin" && (
            <div className="space-y-4">
              <p className="text-lg text-violet-800">
                {pinSet
                  ? "Enter your 4-digit parent PIN."
                  : "Create a 4-digit PIN. This PIN encrypts API keys on this device."}
              </p>
              <input
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className="wf-input text-center text-3xl tracking-[0.6em]"
                placeholder="••••"
                aria-label="Parent PIN"
              />
              {!pinSet && (
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={pinConfirm}
                  onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="wf-input text-center text-3xl tracking-[0.6em]"
                  placeholder="Repeat PIN"
                  aria-label="Confirm PIN"
                />
              )}
              <button type="button" className="wf-btn w-full bg-violet-600 text-white" onClick={() => void submitPin()}>
                Continue
              </button>
              {pinSet && (
                <button
                  type="button"
                  className="text-sm font-bold text-rose-600 underline"
                  onClick={() => {
                    resetParentLock();
                    clearProviderSecrets();
                    setStatus("Parent lock reset. Stored keys were removed.");
                    setStep("pin");
                  }}
                >
                  Forgot PIN? Reset lock and keys
                </button>
              )}
            </div>
          )}

          {step === "dashboard" && (
            <div className="space-y-6">
              <section className="rounded-3xl bg-white p-4 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-xl font-bold text-violet-950">
                  <Sparkles size={20} /> AI Provider
                </h3>
                <label className="mb-2 block text-sm font-bold text-violet-700">Active provider</label>
                <select
                  className="wf-input"
                  value={provider}
                  onChange={(event) => {
                    const next = event.target.value as AiProviderId;
                    const nextModel = PROVIDER_MODELS[next].models[0]?.id ?? "";
                    setProvider(next, nextModel);
                    setCustomModel(nextModel);
                  }}
                >
                  {PROVIDER_ORDER.map((id) => (
                    <option key={id} value={id}>
                      {PROVIDER_MODELS[id].label}
                    </option>
                  ))}
                </select>
                <label className="mb-2 mt-4 block text-sm font-bold text-violet-700">Model</label>
                <select
                  className="wf-input"
                  value={models.some((item) => item.id === customModel) ? customModel : "custom"}
                  onChange={(event) => {
                    if (event.target.value === "custom") return;
                    setCustomModel(event.target.value);
                    setProvider(provider, event.target.value);
                  }}
                >
                  {models.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                  <option value="custom">Custom model id…</option>
                </select>
                <input
                  className="wf-input mt-2"
                  value={customModel}
                  onChange={(event) => setCustomModel(event.target.value)}
                  onBlur={() => setProvider(provider, customModel)}
                  aria-label="Model id"
                />
              </section>

              <section className="rounded-3xl bg-white p-4 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-xl font-bold text-violet-950">
                  <KeyRound size={20} /> Bring Your Own Key
                </h3>
                <p className="mb-4 text-sm text-violet-700">
                  Keys are encrypted with your PIN and stored only on this device. They are never written to logs.
                </p>
                {PROVIDER_ORDER.map((id) => (
                  <label key={id} className="mb-3 block">
                    <span className="mb-1 flex items-center justify-between text-sm font-bold text-violet-800">
                      {PROVIDER_MODELS[id].label}
                      <span className="font-medium text-violet-400">
                        {draftKeys[id] ? redactSecret(draftKeys[id]) : "not set"}
                      </span>
                    </span>
                    <div className="flex gap-2">
                      <input
                        type={showKey && provider === id ? "text" : "password"}
                        autoComplete="off"
                        className="wf-input"
                        placeholder={`${PROVIDER_MODELS[id].label} API key`}
                        value={draftKeys[id] ?? ""}
                        onChange={(event) =>
                          setDraftKeys((current) => ({ ...current, [id]: event.target.value }))
                        }
                      />
                    </div>
                  </label>
                ))}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="wf-btn bg-violet-100 text-violet-950" onClick={() => setShowKey((value) => !value)}>
                    {showKey ? <EyeOff size={20} /> : <Eye size={20} />}
                    {showKey ? "Hide" : "Show"} active key
                  </button>
                  <button type="button" className="wf-btn bg-emerald-300 text-violet-950" onClick={() => void saveKeys()}>
                    <Check size={20} /> Save keys
                  </button>
                  <button
                    type="button"
                    className="wf-btn bg-sky-300 text-violet-950"
                    disabled={testing}
                    onClick={() => void testConnection()}
                  >
                    {testing ? "Testing…" : "Test connection"}
                  </button>
                </div>
                <a
                  className="mt-3 inline-block text-sm font-bold text-violet-700 underline"
                  href="https://openrouter.ai/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                >
                  Connect OpenRouter / existing provider subscriptions
                </a>
                <p className="mt-2 text-xs text-violet-500">
                  {hasStoredSecrets() ? "Encrypted keys are saved locally." : "No encrypted keys stored yet."}
                </p>
              </section>

              <section className="rounded-3xl bg-white p-4 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-xl font-bold text-violet-950">
                  <Shield size={20} /> Account
                </h3>
                <p className="mb-3 text-violet-800">
                  Signed in as {user?.displayName ?? "Explorer"} ({user?.provider ?? "guest"})
                </p>
                <div className="flex flex-wrap gap-2">
                  {authFeatures.google && (
                    <button type="button" className="wf-btn bg-white text-violet-950" onClick={() => void signInGoogle()}>
                      Google
                    </button>
                  )}
                  {authFeatures.apple && (
                    <button type="button" className="wf-btn bg-black text-white" onClick={() => void signInApple()}>
                      Apple
                    </button>
                  )}
                  {authFeatures.passkeys && (
                    <>
                      <button type="button" className="wf-btn bg-violet-200 text-violet-950" onClick={() => void registerDevicePasskey()}>
                        Save passkey
                      </button>
                      <button type="button" className="wf-btn bg-violet-200 text-violet-950" onClick={() => void unlockWithPasskey()}>
                        Unlock with passkey
                      </button>
                    </>
                  )}
                  <button type="button" className="wf-btn bg-rose-200 text-violet-950" onClick={signOut}>
                    <LogOut size={18} /> Sign out
                  </button>
                </div>
                {!authFeatures.google && !authFeatures.apple && (
                  <p className="mt-3 text-sm text-violet-600">
                    Add Google, Apple, Firebase, or Supabase keys in the server environment to enable social login. Guest and passkeys already work.
                  </p>
                )}
              </section>
            </div>
          )}

          {error && <p className="mt-4 rounded-2xl bg-rose-100 p-3 font-bold text-rose-700">{error}</p>}
          {status && <p className="mt-4 rounded-2xl bg-emerald-100 p-3 font-bold text-emerald-800">{status}</p>}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

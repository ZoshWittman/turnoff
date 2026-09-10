"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  KID_AVATARS,
  type AuthUser,
  type KidAvatar,
  type ProfileMode,
  type ProviderSecrets,
} from "@/types";
import { readJson, writeJson, removeItem, storageKeys } from "@/services/secureStorage";
import {
  authEnv,
  createGuestUser,
  registerPasskey,
  signInWithApplePopup,
  signInWithGooglePopup,
  signInWithPasskey,
} from "@/services/authAdapters";
import { hashSecret, verifySecret } from "@/lib/crypto";

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  profileMode: ProfileMode;
  enterKidMode: () => void;
  setAvatar: (avatar: KidAvatar) => void;
  continueAsGuest: (avatar?: KidAvatar) => void;
  signInGoogle: () => Promise<void>;
  signInApple: () => Promise<void>;
  registerDevicePasskey: () => Promise<void>;
  unlockWithPasskey: () => Promise<boolean>;
  signOut: () => void;
  pinSet: boolean;
  setParentPin: (pin: string) => Promise<void>;
  verifyParentPin: (pin: string) => Promise<boolean>;
  resetParentLock: () => void;
  sessionSecrets: ProviderSecrets;
  setSessionSecrets: (secrets: ProviderSecrets) => void;
  authFeatures: {
    google: boolean;
    apple: boolean;
    firebase: boolean;
    supabase: boolean;
    passkeys: boolean;
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [profileMode, setProfileMode] = useState<ProfileMode>("kid");
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [sessionSecrets, setSessionSecrets] = useState<ProviderSecrets>({});

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setUser(readJson<AuthUser | null>(storageKeys.user, null));
      setPinHash(readJson<string | null>(storageKeys.pinHash, null));
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const persistUser = useCallback((next: AuthUser | null) => {
    setUser(next);
    if (next) writeJson(storageKeys.user, next);
    else removeItem(storageKeys.user);
  }, []);

  const continueAsGuest = useCallback(
    (avatar?: KidAvatar) => {
      persistUser(createGuestUser(avatar ?? user?.avatar ?? KID_AVATARS[0]!));
      setProfileMode("kid");
    },
    [persistUser, user?.avatar],
  );

  const setAvatar = useCallback(
    (avatar: KidAvatar) => {
      if (!user) return;
      persistUser({ ...user, avatar, displayName: user.email ? user.displayName : avatar.label });
    },
    [persistUser, user],
  );

  const signInGoogle = useCallback(async () => {
    const next = await signInWithGooglePopup(user?.avatar ?? KID_AVATARS[0]!);
    persistUser(next);
    setProfileMode("kid");
  }, [persistUser, user?.avatar]);

  const signInApple = useCallback(async () => {
    const next = await signInWithApplePopup(user?.avatar ?? KID_AVATARS[0]!);
    persistUser(next);
    setProfileMode("kid");
  }, [persistUser, user?.avatar]);

  const registerDevicePasskey = useCallback(async () => {
    const current = user ?? createGuestUser();
    if (!user) persistUser(current);
    const credentialId = await registerPasskey(current);
    const existing = readJson<string[]>(storageKeys.passkeys, []);
    writeJson(storageKeys.passkeys, [...existing, credentialId]);
    persistUser({ ...current, provider: current.provider === "guest" ? "passkey" : current.provider });
  }, [persistUser, user]);

  const unlockWithPasskey = useCallback(async () => {
    const ids = readJson<string[]>(storageKeys.passkeys, []);
    const ok = await signInWithPasskey(ids);
    if (ok) setProfileMode("parent");
    return ok;
  }, []);

  const signOut = useCallback(() => {
    persistUser(null);
    setProfileMode("kid");
    setSessionSecrets({});
  }, [persistUser]);

  const setParentPin = useCallback(async (pin: string) => {
    const hashed = await hashSecret(pin);
    setPinHash(hashed);
    writeJson(storageKeys.pinHash, hashed);
  }, []);

  const verifyParentPin = useCallback(
    async (pin: string) => {
      if (!pinHash) return true;
      return verifySecret(pin, pinHash);
    },
    [pinHash],
  );

  const resetParentLock = useCallback(() => {
    setPinHash(null);
    removeItem(storageKeys.pinHash);
    removeItem(storageKeys.secrets);
    setSessionSecrets({});
  }, []);

  const env = authEnv();
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      profileMode,
      enterKidMode: () => setProfileMode("kid"),
      setAvatar,
      continueAsGuest,
      signInGoogle,
      signInApple,
      registerDevicePasskey,
      unlockWithPasskey,
      signOut,
      pinSet: Boolean(pinHash),
      setParentPin,
      verifyParentPin,
      resetParentLock,
      sessionSecrets,
      setSessionSecrets,
      authFeatures: {
        google: Boolean(env.googleClientId || env.firebaseApiKey || env.supabaseUrl),
        apple: Boolean(env.appleClientId || env.firebaseApiKey || env.supabaseUrl),
        firebase: Boolean(env.firebaseApiKey),
        supabase: Boolean(env.supabaseUrl),
        passkeys: typeof window !== "undefined" && Boolean(window.PublicKeyCredential),
      },
    }),
    [
      continueAsGuest,
      env.appleClientId,
      env.firebaseApiKey,
      env.googleClientId,
      env.supabaseUrl,
      pinHash,
      profileMode,
      ready,
      registerDevicePasskey,
      resetParentLock,
      sessionSecrets,
      setAvatar,
      setParentPin,
      signInApple,
      signInGoogle,
      signOut,
      unlockWithPasskey,
      user,
      verifyParentPin,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}

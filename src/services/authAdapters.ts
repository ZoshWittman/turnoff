import { KID_AVATARS, type AuthUser, type KidAvatar } from "@/types";

function decodeJwtPayload(token: string): Record<string, string> {
  const part = token.split(".")[1];
  if (!part) throw new Error("Invalid credential");
  const padded = part.replaceAll("-", "+").replaceAll("_", "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return JSON.parse(atob(padded + pad)) as Record<string, string>;
}

export function createGuestUser(avatar: KidAvatar = KID_AVATARS[0]!): AuthUser {
  return {
    id: `guest-${crypto.randomUUID()}`,
    displayName: avatar.label,
    avatar,
    provider: "guest",
    createdAt: new Date().toISOString(),
  };
}

export function userFromJwt(
  credential: string,
  provider: AuthUser["provider"],
  avatar: KidAvatar,
): AuthUser {
  const payload = decodeJwtPayload(credential);
  return {
    id: payload.sub || payload.email || crypto.randomUUID(),
    displayName: payload.name || payload.email?.split("@")[0] || avatar.label,
    email: payload.email,
    photoUrl: payload.picture,
    avatar,
    provider,
    createdAt: new Date().toISOString(),
  };
}

export function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

export function authEnv() {
  return {
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
    appleClientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ?? "",
    appleRedirectUri:
      process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI ??
      (typeof window !== "undefined" ? window.location.origin : ""),
    firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    firebaseAppId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export async function signInWithGooglePopup(avatar: KidAvatar): Promise<AuthUser> {
  const env = authEnv();
  if (env.supabaseUrl && env.supabaseAnonKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    throw new Error("Redirecting to Google…");
  }
  if (env.firebaseApiKey && env.firebaseAuthDomain && env.firebaseProjectId) {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getAuth, GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
    const app =
      getApps()[0] ??
      initializeApp({
        apiKey: env.firebaseApiKey,
        authDomain: env.firebaseAuthDomain,
        projectId: env.firebaseProjectId,
        appId: env.firebaseAppId || "wonderfact-kids",
      });
    const result = await signInWithPopup(getAuth(app), new GoogleAuthProvider());
    return {
      id: result.user.uid,
      displayName: result.user.displayName || avatar.label,
      email: result.user.email ?? undefined,
      photoUrl: result.user.photoURL ?? undefined,
      avatar,
      provider: "firebase",
      createdAt: new Date().toISOString(),
    };
  }
  if (!env.googleClientId) {
    throw new Error("Google sign-in is not configured yet. Grown-ups can add a Google Client ID.");
  }
  await loadScript("https://accounts.google.com/gsi/client", "google-gis");
  return new Promise((resolve, reject) => {
    window.google?.accounts.id.initialize({
      client_id: env.googleClientId,
      callback: (response) => {
        try {
          resolve(userFromJwt(response.credential, "google", avatar));
        } catch (error) {
          reject(error);
        }
      },
      ux_mode: "popup",
    });
    window.google?.accounts.id.prompt();
  });
}

export async function signInWithApplePopup(avatar: KidAvatar): Promise<AuthUser> {
  const env = authEnv();
  if (env.supabaseUrl && env.supabaseAnonKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    throw new Error("Redirecting to Apple…");
  }
  if (env.firebaseApiKey && env.firebaseAuthDomain && env.firebaseProjectId) {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getAuth, OAuthProvider, signInWithPopup } = await import("firebase/auth");
    const app =
      getApps()[0] ??
      initializeApp({
        apiKey: env.firebaseApiKey,
        authDomain: env.firebaseAuthDomain,
        projectId: env.firebaseProjectId,
        appId: env.firebaseAppId || "wonderfact-kids",
      });
    const result = await signInWithPopup(getAuth(app), new OAuthProvider("apple.com"));
    return {
      id: result.user.uid,
      displayName: result.user.displayName || avatar.label,
      email: result.user.email ?? undefined,
      avatar,
      provider: "firebase",
      createdAt: new Date().toISOString(),
    };
  }
  if (!env.appleClientId) {
    throw new Error("Apple sign-in is not configured yet. Grown-ups can add an Apple Service ID.");
  }
  await loadScript(
    "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js",
    "apple-auth",
  );
  window.AppleID?.auth.init({
    clientId: env.appleClientId,
    scope: "name email",
    redirectURI: env.appleRedirectUri,
    usePopup: true,
  });
  const response = await window.AppleID!.auth.signIn();
  return userFromJwt(response.authorization.id_token, "apple", avatar);
}

export async function registerPasskey(user: AuthUser): Promise<string> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "WonderFact Kids", id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(user.id),
        name: user.email || user.displayName,
        displayName: user.displayName,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required",
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Passkey was not created.");
  return btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
}

export async function signInWithPasskey(allowCredentialIds: string[]): Promise<boolean> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const allowCredentials = allowCredentialIds.map((id) => {
    const binary = atob(id);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { type: "public-key" as const, id: bytes };
  });
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge,
      timeout: 60_000,
      userVerification: "required",
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    },
  });
  return Boolean(credential);
}

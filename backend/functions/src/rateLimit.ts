import {HttpsError} from "firebase-functions/v2/https";
import type {Firestore} from "firebase-admin/firestore";
import {REDEEM_ATTEMPT_LIMIT, REDEEM_WINDOW_MS} from "./pairingCode";

export interface RateLimitRecord {
  count: number;
  windowStartMs: number;
}

/** Increments a sliding window counter and throws if the caller is over the cap. */
export async function consumeRateLimit(
  db: Firestore,
  key: string,
  nowMs: number,
  limit: number = REDEEM_ATTEMPT_LIMIT,
  windowMs: number = REDEEM_WINDOW_MS,
): Promise<void> {
  const ref = db.collection("rateLimits").doc(key);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as RateLimitRecord) : null;
    const inWindow = data != null && nowMs - data.windowStartMs < windowMs;
    const count = inWindow ? data.count : 0;
    const windowStartMs = inWindow ? data.windowStartMs : nowMs;
    if (count >= limit) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many pairing attempts. Try again later.",
      );
    }
    tx.set(ref, {count: count + 1, windowStartMs}, {merge: true});
  });
}

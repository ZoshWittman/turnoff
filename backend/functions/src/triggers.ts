import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {writeCommand, shouldExpireTimedLock} from "./commands";
import {commandDataPayload, sendCommandPush} from "./fcm";
import type {DeviceDoc} from "./types";

/** Emits unlock commands for timed locks whose unlockAt has passed. */
export const expireTimedLocks = onSchedule(
  {schedule: "every 1 minutes", region: "us-central1"},
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();
    const snap = await db
      .collection("devices")
      .where("lockState", "==", "locked")
      .where("unlockAt", "<=", now)
      .limit(50)
      .get();

    for (const doc of snap.docs) {
      const device = doc.data() as DeviceDoc;
      const unlockAtMs = device.unlockAt?.toMillis() ?? null;
      if (!shouldExpireTimedLock({
        lockState: device.lockState,
        unlockAtMs,
        nowMs: now.toMillis(),
      })) {
        continue;
      }
      const {commandId} = await writeCommand(db, {
        familyId: device.familyId,
        targetDeviceId: doc.id,
        type: "unlock",
        requestedByUid: "system:expireTimedLocks",
        unlockAt: null,
        lockSource: "schedule",
      });
      if (device.pushToken) {
        try {
          await sendCommandPush(
            getMessaging(),
            device.pushToken,
            commandDataPayload("unlock", commandId, ""),
          );
        } catch (error) {
          console.error("expireTimedLocks push failed", doc.id, error);
        }
      }
    }
  },
);

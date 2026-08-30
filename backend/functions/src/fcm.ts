import type {Messaging} from "firebase-admin/messaging";
import type {CommandType, FcmCommandPayload} from "./types";

export const LOCK_FALLBACK_TITLE = "ParentLock";
export const LOCK_FALLBACK_BODY = "ParentLock needs to apply a lock";
export const UNLOCK_FALLBACK_BODY = "ParentLock needs to unlock this device";
export const UNLOCK_REQUEST_TITLE = "Unlock request";
export const UNLOCK_REQUEST_BODY = "Your child asked to unlock their device";

/** Builds the FCM data object sent to a child device. */
export function commandDataPayload(
  type: CommandType,
  commandId: string,
  unlockAtIso: string | null,
): FcmCommandPayload {
  return {
    type,
    commandId,
    unlockAt: unlockAtIso ?? "",
  };
}

function fallbackBody(type: CommandType): string {
  return type === "unlock" ? UNLOCK_FALLBACK_BODY : LOCK_FALLBACK_BODY;
}

/**
 * Sends a high-priority FCM message with a visible iOS fallback.
 * Silent-only (`apns-push-type: background`) is also requested via content-available,
 * but iOS often drops those, so the alert is required.
 */
export async function sendCommandPush(
  messaging: Messaging,
  token: string,
  payload: FcmCommandPayload,
): Promise<string> {
  return messaging.send({
    token,
    data: {
      type: payload.type,
      commandId: payload.commandId,
      unlockAt: payload.unlockAt,
    },
    android: {priority: "high"},
    apns: {
      headers: {
        "apns-priority": "10",
        "apns-push-type": "alert",
      },
      payload: {
        aps: {
          alert: {
            title: LOCK_FALLBACK_TITLE,
            body: fallbackBody(payload.type),
          },
          sound: "default",
          "content-available": 1,
          "mutable-content": 1,
          category: "PARENTLOCK_COMMAND",
        },
      },
    },
  });
}

/** Notifies every parent device that a child asked to unlock. */
export async function sendUnlockRequestPush(
  messaging: Messaging,
  tokens: string[],
  requestId: string,
  childDeviceId: string,
): Promise<void> {
  const unique = [...new Set(tokens.filter((t) => t.length > 0))];
  await Promise.all(
    unique.map((token) =>
      messaging.send({
        token,
        data: {
          type: "unlock_request",
          requestId,
          childDeviceId,
        },
        android: {priority: "high"},
        apns: {
          headers: {
            "apns-priority": "10",
            "apns-push-type": "alert",
          },
          payload: {
            aps: {
              alert: {
                title: UNLOCK_REQUEST_TITLE,
                body: UNLOCK_REQUEST_BODY,
              },
              sound: "default",
              category: "PARENTLOCK_UNLOCK_REQUEST",
            },
          },
        },
      }),
    ),
  );
}

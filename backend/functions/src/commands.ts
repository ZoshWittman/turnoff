import {FieldValue, Timestamp, type Firestore} from "firebase-admin/firestore";
import type {CommandDoc, CommandType, LockSource} from "./types";

const COMMAND_TTL_MS = 24 * 60 * 60 * 1000;

export interface WriteCommandParams {
  familyId: string;
  targetDeviceId: string;
  type: CommandType;
  requestedByUid: string;
  unlockAt: Timestamp | null;
  lockSource: LockSource;
}

/** Persists a command and updates the device's authoritative lockState. */
export async function writeCommand(
  db: Firestore,
  params: WriteCommandParams,
): Promise<{commandId: string; command: CommandDoc}> {
  const commandRef = db.collection("commands").doc();
  const createdAt = FieldValue.serverTimestamp();
  const command: CommandDoc = {
    familyId: params.familyId,
    targetDeviceId: params.targetDeviceId,
    type: params.type,
    requestedByUid: params.requestedByUid,
    createdAt,
    expiresAt: Timestamp.fromMillis(Date.now() + COMMAND_TTL_MS),
    status: "pending",
    unlockAt: params.unlockAt,
    audit: {requestedByUid: params.requestedByUid, createdAt},
  };
  await commandRef.set(command);

  const deviceUpdate: Record<string, unknown> = {
    lastCommandId: commandRef.id,
    lockState: params.type === "unlock" ? "unlocked" : "locked",
    lockSource: params.type === "unlock" ? null : params.lockSource,
    unlockAt: params.type === "lock_until" ? params.unlockAt : null,
  };
  if (params.type === "unlock") {
    deviceUpdate.lockedAt = null;
  } else {
    deviceUpdate.lockedAt = FieldValue.serverTimestamp();
  }
  await db.collection("devices").doc(params.targetDeviceId).update(deviceUpdate);
  return {commandId: commandRef.id, command};
}

/** True when a timed lock should be cleared by the scheduler. */
export function shouldExpireTimedLock(input: {
  lockState: string;
  unlockAtMs: number | null;
  nowMs: number;
}): boolean {
  return input.lockState === "locked"
    && input.unlockAtMs != null
    && input.unlockAtMs <= input.nowMs;
}

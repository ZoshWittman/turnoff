import type {Timestamp, FieldValue} from "firebase-admin/firestore";

/** Shared Firestore document shapes for ParentLock Cloud Functions. */

export type UserRole = "parent" | "child";

export type LockState = "unlocked" | "locked";

export type LockSource = "parent" | "schedule";

export type CommandType = "lock" | "unlock" | "lock_until";

export type CommandStatus = "pending" | "delivered" | "applied" | "failed";

export type UnlockRequestStatus = "pending" | "approved" | "denied";

export type Platform = "ios" | "android";

export interface UserDoc {
  email: string | null;
  displayName: string;
  roleHint: UserRole | null;
  familyId?: string | null;
  createdAt: Timestamp | FieldValue;
}

export interface FamilyDoc {
  ownerUid: string;
  pairingCode: string | null;
  pairingCodeExpiresAt: Timestamp | null;
  createdAt: Timestamp | FieldValue;
}

export interface MemberDoc {
  role: UserRole;
  displayName: string;
}

export interface PairingCodeDoc {
  familyId: string;
  ownerUid: string;
  expiresAt: Timestamp;
  createdAt: Timestamp | FieldValue;
}

export interface DeviceDoc {
  familyId: string;
  uid: string;
  role: UserRole;
  platform: Platform;
  pushToken: string | null;
  name: string;
  lockState: LockState;
  lockSource: LockSource | null;
  lockedAt: Timestamp | null;
  unlockAt: Timestamp | null;
  lastSeenAt: Timestamp | FieldValue | null;
  lastCommandId: string | null;
}

export interface CommandAudit {
  requestedByUid: string;
  createdAt: Timestamp | FieldValue;
}

export interface CommandDoc {
  familyId: string;
  targetDeviceId: string;
  type: CommandType;
  requestedByUid: string;
  createdAt: Timestamp | FieldValue;
  expiresAt: Timestamp | FieldValue;
  status: CommandStatus;
  unlockAt: Timestamp | null;
  audit: CommandAudit;
}

export interface UnlockRequestDoc {
  familyId: string;
  childDeviceId: string;
  childUid: string;
  status: UnlockRequestStatus;
  createdAt: Timestamp | FieldValue;
}

export interface FcmCommandPayload {
  type: CommandType;
  commandId: string;
  unlockAt: string;
}

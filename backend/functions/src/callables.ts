import {getFirestore, FieldValue, Timestamp} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {
  assertParentCanTargetFamily,
  displayNameFromAuth,
  requireRole,
  requireUid,
  type AuthContext,
} from "./authz";
import {writeCommand} from "./commands";
import {commandDataPayload, sendCommandPush, sendUnlockRequestPush} from "./fcm";
import {
  canonicalizePairingCode,
  generatePairingCode,
  nextPairingExpiry,
  pairingQrPayload,
} from "./pairingCode";
import {consumeRateLimit} from "./rateLimit";
import type {
  CommandDoc,
  CommandType,
  DeviceDoc,
  FamilyDoc,
  PairingCodeDoc,
  Platform,
  UnlockRequestDoc,
  UserRole,
} from "./types";

const REGION = "us-central1";

function db() {
  return getFirestore();
}

function nowTs(): Timestamp {
  return Timestamp.now();
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseUnlockAt(value: unknown): Timestamp | null {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "unlockAt must be an ISO-8601 string.");
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new HttpsError("invalid-argument", "unlockAt must be an ISO-8601 string.");
  }
  return Timestamp.fromMillis(ms);
}

async function upsertUser(
  uid: string,
  auth: AuthContext,
  roleHint: UserRole | null,
  displayName: string,
  familyId?: string,
): Promise<void> {
  const payload: Record<string, unknown> = {
    email: auth.token.email ?? null,
    displayName,
    roleHint,
  };
  if (familyId) {
    payload.familyId = familyId;
  }
  const ref = db().collection("users").doc(uid);
  const existing = await ref.get();
  if (!existing.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
  }
  await ref.set(payload, {merge: true});
}

async function familyIdForUid(uid: string): Promise<string | null> {
  const userSnap = await db().collection("users").doc(uid).get();
  const fromProfile = optionalString(userSnap.data()?.familyId);
  if (fromProfile) {
    return fromProfile;
  }
  const owned = await db()
    .collection("families")
    .where("ownerUid", "==", uid)
    .limit(1)
    .get();
  if (!owned.empty) {
    return owned.docs[0].id;
  }
  return null;
}

async function pushCommandToDevice(
  device: DeviceDoc,
  type: CommandType,
  commandId: string,
  unlockAt: Timestamp | null,
): Promise<void> {
  if (!device.pushToken) {
    return;
  }
  const payload = commandDataPayload(
    type,
    commandId,
    unlockAt ? unlockAt.toDate().toISOString() : "",
  );
  try {
    await sendCommandPush(getMessaging(), device.pushToken, payload);
  } catch (error) {
    console.error("FCM send failed", commandId, error);
  }
}

/** Creates a family if needed and returns a 24h pairing code plus QR payload. */
export const createPairingCode = onCall({region: REGION}, async (request) => {
  const uid = requireUid(request.auth as AuthContext | undefined);
  const auth = request.auth as AuthContext;
  const displayName = displayNameFromAuth(auth, "Parent");
  await upsertUser(uid, auth, "parent", displayName);

  let familyId = optionalString(request.data?.familyId) ?? (await familyIdForUid(uid));
  const database = db();

  if (familyId) {
    await requireRole(database, familyId, uid, "parent");
  } else {
    const familyRef = database.collection("families").doc();
    familyId = familyRef.id;
    const family: FamilyDoc = {
      ownerUid: uid,
      pairingCode: null,
      pairingCodeExpiresAt: null,
      createdAt: FieldValue.serverTimestamp(),
    };
    const batch = database.batch();
    batch.set(familyRef, family);
    batch.set(familyRef.collection("members").doc(uid), {
      role: "parent",
      displayName,
    });
    await batch.commit();
    await upsertUser(uid, auth, "parent", displayName, familyId);
  }

  const code = generatePairingCode();
  const expiresAtMs = nextPairingExpiry(Date.now());
  const expiresAt = Timestamp.fromMillis(expiresAtMs);
  const pairing: PairingCodeDoc = {
    familyId,
    ownerUid: uid,
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
  };

  await database.collection("pairingCodes").doc(code).set(pairing);
  await database.collection("families").doc(familyId).update({
    pairingCode: code,
    pairingCodeExpiresAt: expiresAt,
  });

  return {
    familyId,
    code,
    expiresAt: new Date(expiresAtMs).toISOString(),
    qrPayload: pairingQrPayload(code),
  };
});

/** Attaches a child account and device to a family. */
export const redeemPairingCode = onCall({region: REGION}, async (request) => {
  const uid = requireUid(request.auth as AuthContext | undefined);
  const auth = request.auth as AuthContext;
  const rawCode = requireString(request.data?.code, "code");
  const code = canonicalizePairingCode(rawCode);
  if (!code) {
    throw new HttpsError("invalid-argument", "Enter the 6-character pairing code.");
  }
  const deviceName = requireString(request.data?.deviceName ?? "Child iPhone", "deviceName");
  const platform = (optionalString(request.data?.platform) ?? "ios") as Platform;
  if (platform !== "ios" && platform !== "android") {
    throw new HttpsError("invalid-argument", "Unsupported platform.");
  }
  const displayName = optionalString(request.data?.displayName)
    ?? displayNameFromAuth(auth, "Child");

  await consumeRateLimit(db(), `redeem:${uid}`, Date.now());

  const pairingRef = db().collection("pairingCodes").doc(code);
  const pairingSnap = await pairingRef.get();
  if (!pairingSnap.exists) {
    throw new HttpsError("not-found", "That pairing code is not valid.");
  }
  const pairing = pairingSnap.data() as PairingCodeDoc;
  if (pairing.expiresAt.toMillis() <= Date.now()) {
    throw new HttpsError("failed-precondition", "That pairing code has expired.");
  }

  const existingMember = await db()
    .collection("families")
    .doc(pairing.familyId)
    .collection("members")
    .doc(uid)
    .get();
  if (existingMember.exists && existingMember.data()?.role === "parent") {
    throw new HttpsError(
      "failed-precondition",
      "This account is already a parent in the family.",
    );
  }

  const deviceRef = db().collection("devices").doc();
  const device: DeviceDoc = {
    familyId: pairing.familyId,
    uid,
    role: "child",
    platform,
    pushToken: optionalString(request.data?.pushToken),
    name: deviceName,
    lockState: "unlocked",
    lockSource: null,
    lockedAt: null,
    unlockAt: null,
    lastSeenAt: FieldValue.serverTimestamp(),
    lastCommandId: null,
  };

  const batch = db().batch();
  batch.set(
    db().collection("families").doc(pairing.familyId).collection("members").doc(uid),
    {role: "child", displayName},
    {merge: true},
  );
  batch.set(deviceRef, device);
  await batch.commit();
  await upsertUser(uid, auth, "child", displayName, pairing.familyId);

  return {
    familyId: pairing.familyId,
    deviceId: deviceRef.id,
  };
});

/** Parent-issued lock, unlock, or timed lock. Writes lockState; children cannot. */
export const sendDeviceCommand = onCall({region: REGION}, async (request) => {
  const uid = requireUid(request.auth as AuthContext | undefined);
  const targetDeviceId = requireString(request.data?.targetDeviceId, "targetDeviceId");
  const type = requireString(request.data?.type, "type") as CommandType;
  if (type !== "lock" && type !== "unlock" && type !== "lock_until") {
    throw new HttpsError("invalid-argument", "type must be lock, unlock, or lock_until.");
  }
  const unlockAt = type === "lock_until" ? parseUnlockAt(request.data?.unlockAt) : null;
  if (type === "lock_until" && (!unlockAt || unlockAt.toMillis() <= Date.now())) {
    throw new HttpsError("invalid-argument", "lock_until requires a future unlockAt.");
  }

  const deviceSnap = await db().collection("devices").doc(targetDeviceId).get();
  if (!deviceSnap.exists) {
    throw new HttpsError("not-found", "Device not found.");
  }
  const device = deviceSnap.data() as DeviceDoc;
  if (device.role !== "child") {
    throw new HttpsError("failed-precondition", "Only child devices can be locked.");
  }
  await requireRole(db(), device.familyId, uid, "parent");
  assertParentCanTargetFamily(device.familyId, device.familyId);

  const {commandId} = await writeCommand(db(), {
    familyId: device.familyId,
    targetDeviceId,
    type,
    requestedByUid: uid,
    unlockAt,
    lockSource: type === "lock_until" ? "schedule" : "parent",
  });
  await pushCommandToDevice(device, type, commandId, unlockAt);
  return {commandId, status: "pending"};
});

/** Child asks a parent to unlock. */
export const requestUnlock = onCall({region: REGION}, async (request) => {
  const uid = requireUid(request.auth as AuthContext | undefined);
  const childDeviceId = requireString(request.data?.childDeviceId, "childDeviceId");
  const deviceSnap = await db().collection("devices").doc(childDeviceId).get();
  if (!deviceSnap.exists) {
    throw new HttpsError("not-found", "Device not found.");
  }
  const device = deviceSnap.data() as DeviceDoc;
  if (device.uid !== uid || device.role !== "child") {
    throw new HttpsError("permission-denied", "Only the child device may request unlock.");
  }

  const requestRef = db().collection("unlockRequests").doc();
  const doc: UnlockRequestDoc = {
    familyId: device.familyId,
    childDeviceId,
    childUid: uid,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  };
  await requestRef.set(doc);

  const parents = await db()
    .collection("devices")
    .where("familyId", "==", device.familyId)
    .where("role", "==", "parent")
    .get();
  const tokens = parents.docs
    .map((d) => (d.data() as DeviceDoc).pushToken)
    .filter((t): t is string => typeof t === "string" && t.length > 0);
  try {
    await sendUnlockRequestPush(getMessaging(), tokens, requestRef.id, childDeviceId);
  } catch (error) {
    console.error("Unlock request push failed", error);
  }
  return {requestId: requestRef.id};
});

/** Parent approve emits an unlock command; deny only updates status. */
export const resolveUnlockRequest = onCall({region: REGION}, async (request) => {
  const uid = requireUid(request.auth as AuthContext | undefined);
  const requestId = requireString(request.data?.requestId, "requestId");
  const decision = requireString(request.data?.decision, "decision");
  if (decision !== "approved" && decision !== "denied") {
    throw new HttpsError("invalid-argument", "decision must be approved or denied.");
  }

  const snap = await db().collection("unlockRequests").doc(requestId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Unlock request not found.");
  }
  const unlockRequest = snap.data() as UnlockRequestDoc;
  await requireRole(db(), unlockRequest.familyId, uid, "parent");
  if (unlockRequest.status !== "pending") {
    throw new HttpsError("failed-precondition", "This request was already resolved.");
  }

  await snap.ref.update({status: decision});
  if (decision === "denied") {
    return {status: "denied"};
  }

  const deviceSnap = await db().collection("devices").doc(unlockRequest.childDeviceId).get();
  if (!deviceSnap.exists) {
    throw new HttpsError("not-found", "Child device not found.");
  }
  const device = deviceSnap.data() as DeviceDoc;
  const {commandId} = await writeCommand(db(), {
    familyId: device.familyId,
    targetDeviceId: unlockRequest.childDeviceId,
    type: "unlock",
    requestedByUid: uid,
    unlockAt: null,
    lockSource: "parent",
  });
  await pushCommandToDevice(device, "unlock", commandId, null);
  return {status: "approved", commandId};
});

/** Child reports that a command was applied (or failed) on-device. */
export const acknowledgeCommand = onCall({region: REGION}, async (request) => {
  const uid = requireUid(request.auth as AuthContext | undefined);
  const commandId = requireString(request.data?.commandId, "commandId");
  const status = requireString(request.data?.status, "status");
  if (status !== "applied" && status !== "failed" && status !== "delivered") {
    throw new HttpsError("invalid-argument", "status must be delivered, applied, or failed.");
  }
  const snap = await db().collection("commands").doc(commandId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Command not found.");
  }
  const command = snap.data() as CommandDoc;
  const deviceSnap = await db().collection("devices").doc(command.targetDeviceId).get();
  if (!deviceSnap.exists || deviceSnap.data()?.uid !== uid) {
    throw new HttpsError("permission-denied", "Only the target device may acknowledge.");
  }
  await snap.ref.update({status});
  await deviceSnap.ref.update({
    lastSeenAt: nowTs(),
    lastCommandId: commandId,
  });
  return {status};
});

/** Parent or child updates the push token for a device they own. */
export const registerDeviceToken = onCall({region: REGION}, async (request) => {
  const uid = requireUid(request.auth as AuthContext | undefined);
  const deviceId = optionalString(request.data?.deviceId);
  const pushToken = optionalString(request.data?.pushToken);
  const name = optionalString(request.data?.name);
  const role = (optionalString(request.data?.role) ?? "parent") as UserRole;
  const familyId = optionalString(request.data?.familyId);
  const platform = (optionalString(request.data?.platform) ?? "ios") as Platform;

  if (deviceId) {
    const snap = await db().collection("devices").doc(deviceId).get();
    if (!snap.exists || snap.data()?.uid !== uid) {
      throw new HttpsError("permission-denied", "Cannot update another user's device.");
    }
    const update: Record<string, unknown> = {lastSeenAt: FieldValue.serverTimestamp()};
    if (pushToken) {
      update.pushToken = pushToken;
    }
    if (name) {
      update.name = name;
    }
    await snap.ref.update(update);
    return {deviceId};
  }

  if (!familyId) {
    throw new HttpsError("invalid-argument", "familyId is required to register a new device.");
  }
  await requireRole(db(), familyId, uid, role);
  const ref = db().collection("devices").doc();
  const device: DeviceDoc = {
    familyId,
    uid,
    role,
    platform,
    pushToken,
    name: name ?? (role === "parent" ? "Parent iPhone" : "Child iPhone"),
    lockState: "unlocked",
    lockSource: null,
    lockedAt: null,
    unlockAt: null,
    lastSeenAt: FieldValue.serverTimestamp(),
    lastCommandId: null,
  };
  await ref.set(device);
  return {deviceId: ref.id};
});

/** Removes a child device from the family (parent only). */
export const unpairDevice = onCall({region: REGION}, async (request) => {
  const uid = requireUid(request.auth as AuthContext | undefined);
  const deviceId = requireString(request.data?.deviceId, "deviceId");
  const snap = await db().collection("devices").doc(deviceId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Device not found.");
  }
  const device = snap.data() as DeviceDoc;
  await requireRole(db(), device.familyId, uid, "parent");
  await snap.ref.delete();
  return {ok: true};
});

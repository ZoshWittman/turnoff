import {HttpsError} from "firebase-functions/v2/https";
import type {Firestore} from "firebase-admin/firestore";
import type {MemberDoc, UserRole} from "./types";

export interface AuthContext {
  uid: string;
  token: {email?: string; name?: string};
}

/** Requires a signed-in Firebase user. */
export function requireUid(auth: AuthContext | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  return auth.uid;
}

export function displayNameFromAuth(auth: AuthContext, fallback: string): string {
  const fromToken = auth.token.name?.trim();
  if (fromToken) {
    return fromToken;
  }
  const email = auth.token.email?.trim();
  if (email) {
    return email.split("@")[0] ?? fallback;
  }
  return fallback;
}

/** Loads a family membership or throws. */
export async function requireMember(
  db: Firestore,
  familyId: string,
  uid: string,
): Promise<MemberDoc> {
  const snap = await db
    .collection("families")
    .doc(familyId)
    .collection("members")
    .doc(uid)
    .get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "Not a member of this family.");
  }
  return snap.data() as MemberDoc;
}

export async function requireRole(
  db: Firestore,
  familyId: string,
  uid: string,
  role: UserRole,
): Promise<MemberDoc> {
  const member = await requireMember(db, familyId, uid);
  if (member.role !== role) {
    throw new HttpsError(
      "permission-denied",
      `This action requires the ${role} role.`,
    );
  }
  return member;
}

export function assertParentCanTargetFamily(
  memberFamilyId: string,
  deviceFamilyId: string,
): void {
  if (memberFamilyId !== deviceFamilyId) {
    throw new HttpsError(
      "permission-denied",
      "Parents cannot lock devices outside their family.",
    );
  }
}

import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {shouldExpireTimedLock} from "../commands";
import {commandDataPayload} from "../fcm";
import {assertParentCanTargetFamily} from "../authz";

describe("shouldExpireTimedLock", () => {
  const now = 1_700_000_100_000;

  it("expires a locked device whose unlockAt is in the past", () => {
    assert.equal(
      shouldExpireTimedLock({lockState: "locked", unlockAtMs: now - 1, nowMs: now}),
      true,
    );
  });

  it("does not expire an unlocked device", () => {
    assert.equal(
      shouldExpireTimedLock({lockState: "unlocked", unlockAtMs: now - 1, nowMs: now}),
      false,
    );
  });

  it("does not expire a lock with no unlockAt (indefinite)", () => {
    assert.equal(
      shouldExpireTimedLock({lockState: "locked", unlockAtMs: null, nowMs: now}),
      false,
    );
  });

  it("does not expire a future timed lock", () => {
    assert.equal(
      shouldExpireTimedLock({lockState: "locked", unlockAtMs: now + 60_000, nowMs: now}),
      false,
    );
  });
});

describe("commandDataPayload", () => {
  it("uses an empty unlockAt string when the lock is indefinite", () => {
    assert.deepEqual(commandDataPayload("lock", "cmd-1", null), {
      type: "lock",
      commandId: "cmd-1",
      unlockAt: "",
    });
  });

  it("passes through ISO unlockAt for lock_until", () => {
    const iso = "2026-08-30T12:00:00.000Z";
    assert.deepEqual(commandDataPayload("lock_until", "cmd-2", iso), {
      type: "lock_until",
      commandId: "cmd-2",
      unlockAt: iso,
    });
  });
});

describe("assertParentCanTargetFamily", () => {
  it("allows matching family ids", () => {
    assert.doesNotThrow(() => assertParentCanTargetFamily("fam-a", "fam-a"));
  });

  it("rejects a device from another family", () => {
    assert.throws(
      () => assertParentCanTargetFamily("fam-a", "fam-b"),
      /outside their family/,
    );
  });
});

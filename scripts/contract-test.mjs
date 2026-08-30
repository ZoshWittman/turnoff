#!/usr/bin/env node
/** Structural contract checks for ParentLock (runs without Xcode). */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

const required = [
  "README.md",
  "docs/SETUP.md",
  "docs/ARCHITECTURE.md",
  "docs/ENTITLEMENTS.md",
  "firestore.rules",
  "firebase.json",
  "backend/functions/src/index.ts",
  "backend/functions/src/callables.ts",
  "iOS/ParentLock.xcodeproj/project.pbxproj",
  "iOS/ParentLock/App/ParentLockApp.swift",
  "iOS/ParentLockShared/ShieldService.swift",
  "iOS/ParentLockMonitor/DeviceActivityMonitorExtension.swift",
  "iOS/ParentLockShieldConfig/ShieldConfigurationExtension.swift",
  "iOS/ParentLockShieldAction/ShieldActionExtension.swift",
  "iOS/ParentLockNotificationService/NotificationService.swift",
];

for (const rel of required) {
  assert.ok(exists(rel), `missing ${rel}`);
}

const constants = read("iOS/ParentLockShared/SharedConstants.swift");
assert.match(constants, /parentlock\.lock/);
assert.match(constants, /group\.com\.parentlock\.shared/);

const shield = read("iOS/ParentLockShared/ShieldService.swift");
assert.match(shield, /func applyLock\(except/);
assert.match(shield, /func clearLock\(\)/);
assert.match(shield, /applicationCategories = \.all\(except:/);
assert.match(shield, /clearAllSettings/);
assert.match(shield, /explicitBlockList/);

const entitlements = [
  "iOS/ParentLock/Resources/ParentLock.entitlements",
  "iOS/ParentLockMonitor/ParentLockMonitor.entitlements",
  "iOS/ParentLockShieldConfig/ParentLockShieldConfig.entitlements",
  "iOS/ParentLockShieldAction/ParentLockShieldAction.entitlements",
];
for (const rel of entitlements) {
  const body = read(rel);
  assert.match(body, /com\.apple\.developer\.family-controls/);
  assert.match(body, /group\.com\.parentlock\.shared/);
}

const index = read("backend/functions/src/index.ts");
for (const name of [
  "createPairingCode",
  "redeemPairingCode",
  "sendDeviceCommand",
  "resolveUnlockRequest",
  "expireTimedLocks",
]) {
  assert.match(index, new RegExp(name));
}

const rules = read("firestore.rules");
assert.match(rules, /allow create, update, delete: if false/);
assert.match(rules, /pairingCodes/);
assert.match(rules, /lockState/);

const pbx = read("iOS/ParentLock.xcodeproj/project.pbxproj");
assert.match(pbx, /com\.parentlock\.app/);
assert.match(pbx, /com\.parentlock\.app\.monitor/);
assert.match(pbx, /firebase-ios-sdk/);
assert.match(pbx, /IPHONEOS_DEPLOYMENT_TARGET = 17\.0/);

const docs = read("docs/ENTITLEMENTS.md");
assert.match(docs, /developer\.apple\.com\/contact\/request\/family-controls-distribution/);

console.log("contract-test: ok");

# ParentLock architecture

## Goal

A parent issues Lock / Unlock / timed lock from their iPhone. The child iPhone or iPad applies or clears a named `ManagedSettingsStore` so normal apps are shielded until the parent unlocks.

Apple does not allow a parent process to write `ManagedSettingsStore` onto another device. The child process is the only writer of shields.

```
Parent app  --HTTPS callables-->  Cloud Functions  --Admin SDK-->  Firestore
                                         |
                                         +-- FCM data + visible fallback --> Child app
                                                                              |
                                                                              +-- ShieldService (local)
                                                                              +-- DeviceActivity schedule (timed unlock)
```

## Roles

One iOS app, role chosen at onboarding.

| Role | Family Controls | What it does |
| --- | --- | --- |
| Parent | Not required to send commands | Creates family, pairing code, Lock / Unlock / lock-until, unlock-request inbox |
| Child | `requestAuthorization(for: .child)` | Redeems code, picks always-allowed apps, registers for push, applies shields |

`.individual` is never used for the child. That authorization is for self-control apps and can be removed by the child.

## Command path

1. Parent taps Lock on a child card.
2. `sendDeviceCommand` validates that the caller is a **parent member** of the device’s family.
3. Function writes `commands/{commandId}` (`status: pending`) and is the **only writer** of `devices/{id}.lockState`.
4. Function sends FCM:
   - data payload `{ type, commandId, unlockAt }`
   - `apns-push-type: alert` plus `content-available: 1` (visible fallback because iOS drops silent pushes)
5. Child applies shields **synchronously** when the command is seen, then calls `acknowledgeCommand`.
6. Dedup key: `devices/{id}.lastCommandId` mirrored into the App Group.

Because iOS background delivery is best-effort, the child also:

- Handles `application(_:didReceiveRemoteNotification:fetchCompletionHandler:)`
- Listens to `devices/{deviceId}` in Firestore while the app is active
- Re-reads desired lock state on every foreground
- Registers `BGAppRefreshTask` (`com.parentlock.refresh`)
- Stores `pendingCommand` in the App Group so the shield action / monitor can see intent

## Shield application (child only)

Named store: `ManagedSettingsStore(named: .init("parentlock.lock"))`.

Primary strategy (`ShieldStrategy.categoriesAllExcept`):

```swift
store.shield.applicationCategories = .all(except: selection.applicationTokens)
store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
```

Fallback (`ShieldStrategy.explicitBlockList`), behind a comment: if `.all(except:)` is insufficient on a given iOS version, persist a second `FamilyActivitySelection` (“Apps to lock”) and set `store.shield.applications` plus `store.shield.applicationCategories = .specific(...)`.

Always-allowed tokens are chosen **on the child** during setup via `FamilyActivityPicker`. They are opaque and device-local. They are **not** uploaded to the server.

Phone, emergency calling, and Settings must remain reachable. Instruct the user to include Phone and ParentLock in the always-allowed picker. Some system apps cannot be shielded; that is an OS limitation, not a product bug.

## Timed lock

`type: lock_until` with `unlockAt`.

- Server stores `unlockAt` on the command and the device.
- Child starts `DeviceActivityCenter` schedule `parentlock.timedUnlock` from `Date()` to `unlockAt`.
- `ParentLockMonitor.intervalDidEnd` calls `ShieldService.clearLock()` and writes an App Group flag so the main app / next refresh reports `lockState=unlocked` via `acknowledgeCommand` or the scheduled function.
- Cloud Function `expireTimedLocks` (scheduler) emits an unlock command if `unlockAt` is in the past and the device is still locked. This covers killed apps and missed monitor callbacks.

## Unlock requests

Child shield button or in-app **Ask to unlock**:

1. Shield action writes `pendingUnlockRequest` in the App Group, posts a Darwin notification, and schedules a local notification that opens the child app (extensions cannot reliably hit the network).
2. Main app / notification path calls `requestUnlock`.
3. Parent sees a banner + actionable notification.
4. `resolveUnlockRequest` (approve) emits an unlock command. Deny only updates the request status.

## Token persistence

`FamilyActivitySelection` is `Codable` on recent SDKs. The child writes it with `PropertyListEncoder` into the App Group file `always-allowed.plist`. Never serialize tokens to Firestore for reuse on the parent device.

## Collections

```
users/{uid}
  email, displayName, roleHint, createdAt

families/{familyId}
  ownerUid, pairingCode, pairingCodeExpiresAt, createdAt

families/{familyId}/members/{uid}
  role: parent | child
  displayName

pairingCodes/{code}          # Admin SDK only
  familyId, ownerUid, expiresAt, createdAt

devices/{deviceId}
  familyId, uid, role, platform, pushToken, name
  lockState: unlocked | locked
  lockSource: parent | schedule
  lockedAt, unlockAt
  lastSeenAt, lastCommandId

commands/{commandId}
  familyId, targetDeviceId, type, requestedByUid
  createdAt, expiresAt, status, unlockAt, audit

unlockRequests/{id}
  familyId, childDeviceId, childUid, status, createdAt

rateLimits/{id}              # Admin SDK only
```

## Security model

- HTTPS only. The iOS client holds no secrets except the Firebase plist.
- Pairing codes: 6 characters from a 32-symbol alphabet (no `0/O/1/I`), 30 bits of entropy, 24h expiry, redeem rate-limited.
- Pairing documents are readable only by Cloud Functions. Clients never query `pairingCodes`.
- `lockState` is writable only by the Admin SDK (Cloud Functions). A child client cannot unlock themselves by editing Firestore.
- Parents cannot target devices outside their family.
- Commands carry `audit: { requestedByUid, createdAt }`.

See `firestore.rules`.

## Extensions

| Target | Point | Job |
| --- | --- | --- |
| ParentLockMonitor | `DeviceActivityMonitor` | Timed unlock: `intervalDidEnd` → `clearLock()` |
| ParentLockShieldConfig | `ShieldConfigurationDataSource` | Branded “Locked by parent” shield |
| ParentLockShieldAction | `ShieldActionDelegate` | Primary button → unlock-request flag + Darwin + local notification |
| ParentLockNotificationService | Notification service | Optional mutation / App Group write when a visible lock ping arrives |

All Screen Time extensions need the Family Controls capability. The notification service does not.

## Push

APNs via Firebase Cloud Messaging.

- Register the APNs token on every refresh; upload to `devices/{id}.pushToken`.
- Data message + visible notification. Tapping opens the child app and applies the pending command.
- Child also uses `Messaging.messaging().apnsToken` / FCM token refresh.

## Logging

`os.Logger` subsystem `com.parentlock`. Categories match service names (`auth`, `shield`, `command`, `push`, `family`).

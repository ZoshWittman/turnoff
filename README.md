# ParentLock

ParentLock is a parental-control product for iPhone and iPad. A parent taps **Lock** on their iPhone. Within a few seconds the child’s device becomes unusable for normal apps — shielded and locked down — until the parent unlocks it.

This is **not** a hardware power-off. Apple does not allow third-party App Store apps to shut down a device. ParentLock uses Apple’s Screen Time APIs (`FamilyControls`, `ManagedSettings`, `ManagedSettingsUI`, `DeviceActivity`) to shield apps on the **child device only**. The parent sends a command to Firebase; the child applies the shield locally.

Minimum iOS: **17.0**. Bundle ID prefix: `com.parentlock`. Brand name in code: `ParentLock`.

## What ParentLock does not do

- It does not power off, restart, or sleep the device.
- It does not use MDM, private APIs, jailbreak, Guided Access hacks, or fake lock-screen overlays.
- It does not read which apps the child uses. Family Controls tokens stay on the child device.
- It does not track location.
- Phone / emergency calling remains available. Some system apps cannot be shielded.

## Architecture

```
[Parent iOS] --HTTPS--> [Firebase] --FCM/APNs--> [Child iOS]
                 |              |
                 +-- Firestore + Cloud Functions
```

The parent never writes `ManagedSettingsStore` onto the child. Shields are applied on the child after a command is received (push, notification tap, Firestore listener, or background refresh).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Repository layout

```
docs/                         Product and platform docs
iOS/ParentLock/               SwiftUI app
iOS/ParentLockShared/         Shared lock/state code (app + extensions)
iOS/ParentLockMonitor/        Device Activity Monitor extension
iOS/ParentLockShieldConfig/   Custom shield UI
iOS/ParentLockShieldAction/   Shield “Ask to unlock” action
iOS/ParentLockNotificationService/
backend/functions/            Cloud Functions (TypeScript, Node 20)
firestore.rules               Locked-down security rules
```

## What you must do manually

Screen Time APIs do not work in Simulator. You cannot finish v1 from this Linux checkout alone.

1. Create Apple Developer App IDs + App Group `group.com.parentlock.shared`.
2. Request the Family Controls (Distribution) entitlement for all four Screen Time bundle IDs. See [docs/ENTITLEMENTS.md](docs/ENTITLEMENTS.md).
3. Create a Firebase project, add the iOS app, download `GoogleService-Info.plist` into `iOS/ParentLock/`, and deploy functions + rules.
4. Use two Apple IDs in one Family Sharing group (parent/guardian + child).
5. Run on two **real devices**, not Simulator.

Full walkthrough: [docs/SETUP.md](docs/SETUP.md).

## Testing checklist

Requires two physical devices and Family Sharing:

- [ ] Child authorization sheet approved by parent Apple ID
- [ ] Child cannot delete ParentLock from Home Screen
- [ ] Parent Lock shields Safari and a third-party app
- [ ] Phone still opens
- [ ] Parent Unlock clears shields
- [ ] Kill child app, send Lock, tap the fallback notification, shields apply
- [ ] Timed 15-minute lock auto-unlocks
- [ ] Unlock request appears on parent and approve works
- [ ] Reboot child device: lock state is re-applied on next command or on app launch by reading Firestore

## Backend tests (this repo)

```bash
cd backend/functions
npm install
npm test
npx tsc --noEmit
```

## Privacy

ParentLock stores lock state, device metadata, and commands on the server. It does not receive the child’s app list. Opaque Screen Time tokens never leave the child device.

## Out of scope for v1

Android, location, usage dashboards, web parent portal, subscription, MDM / `ShutDownDevice`.

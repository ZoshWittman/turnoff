# ParentLock setup

v1 must be exercised on two physical devices. Screen Time APIs (`FamilyControls`, `ManagedSettings`, `DeviceActivity`) do not apply shields in Simulator.

## Requirements

| Item | Version / note |
| --- | --- |
| Xcode | 15.4 or newer (16 recommended) |
| iOS deployment target | 17.0 |
| Two iPhone or iPad devices | One parent, one child |
| Two Apple IDs | Same Family Sharing group; parent/guardian can approve Screen Time |
| Apple Developer Program | Paid team, for App IDs, App Group, push, TestFlight |
| Firebase | Blaze recommended if you exceed free Cloud Functions quota |
| Node | 20.x for Cloud Functions |

## 1. Apple Developer identifiers

In [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list):

### App IDs

| Bundle ID | Target | Capabilities |
| --- | --- | --- |
| `com.parentlock.app` | ParentLock | App Groups, Family Controls, Push Notifications, Sign in with Apple |
| `com.parentlock.app.monitor` | ParentLockMonitor | App Groups, Family Controls |
| `com.parentlock.app.shieldconfig` | ParentLockShieldConfig | App Groups, Family Controls |
| `com.parentlock.app.shieldaction` | ParentLockShieldAction | App Groups, Family Controls |
| `com.parentlock.app.notificationservice` | ParentLockNotificationService | App Groups, Push Notifications |

### App Group

Create `group.com.parentlock.shared` and attach it to every App ID above.

### Team ID

Open the Xcode project, select each target, and set your Development Team. The project ships without a team so it opens on any machine.

## 2. Family Controls distribution entitlement

Development Family Controls works for a local team during bring-up. TestFlight and App Store require **Family Controls (Distribution)** on every Screen Time target.

Request it at:

https://developer.apple.com/contact/request/family-controls-distribution

Submit **four** requests (or one request listing all four bundle IDs):

1. `com.parentlock.app`
2. `com.parentlock.app.monitor`
3. `com.parentlock.app.shieldconfig`
4. `com.parentlock.app.shieldaction`

See [ENTITLEMENTS.md](ENTITLEMENTS.md) for the copy to paste into the form.

Until Apple approves distribution, you can still run from Xcode on devices registered to your team if the development entitlement is present.

## 3. Family Sharing test accounts

1. Create (or use) two Apple IDs. Do not use the same ID on both devices for the `.child` authorization path.
2. On the parent Apple ID, open Settings → Family and invite the child Apple ID.
3. Sign the child device into iCloud with the child Apple ID.
4. When ParentLock on the child calls `AuthorizationCenter.shared.requestAuthorization(for: .child)`, a parent/guardian in that Family Sharing group must approve the sheet **on the child device**.
5. After approval, iOS prevents the child from deleting the app and from signing out of iCloud.

Do **not** use `.individual` for the child role. `.individual` is for self-control apps and the child can remove the app.

## 4. Firebase

1. Create a project at https://console.firebase.google.com (name it `parentlock` or similar).
2. Enable **Authentication** → Email/Password and Sign in with Apple.
   - Sign in with Apple: add your Team ID, Key ID, and private key (or use the Firebase iOS SDK’s native flow, which does not need a server key for the client).
3. Create a Firestore database in production mode, then deploy the rules in this repo (do not leave test mode).
4. Add an iOS app with bundle ID `com.parentlock.app`.
5. Download `GoogleService-Info.plist` and place it at `iOS/ParentLock/GoogleService-Info.plist` (gitignored). A placeholder lives at `iOS/ParentLock/GoogleService-Info.plist.example`.
6. Enable Cloud Messaging. Upload an APNs authentication key (`.p8`) from Apple Developer → Keys.
7. Enable Cloud Functions. From the repo root:

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # select your project
cd backend/functions && npm install && npm run build
cd ../..
firebase deploy --only functions,firestore:rules,firestore:indexes
```

8. In Firebase Authentication settings, add the iOS bundle ID and (for Sign in with Apple) the Services ID if you use a web client later. v1 is iOS-only.

## 5. Open the Xcode project

```bash
# Optional: regenerate the project from project.yml if you have XcodeGen
brew install xcodegen
cd iOS && xcodegen generate
```

Or open `iOS/ParentLock.xcodeproj` directly.

1. Set the Development Team on all six targets (app, shared framework, four extensions).
2. Confirm each target’s entitlements file is selected.
3. Drop in `GoogleService-Info.plist`.
4. Resolve Swift packages (Firebase iOS SDK).
5. Select a physical device and Run `ParentLock`.

The shared framework `ParentLockShared` must be embedded in the app and linked (not embedded) from the extensions.

## 6. First-run pairing

**Parent device**

1. Sign in (email + password or Sign in with Apple).
2. Choose role **Parent**.
3. Create a family. A 6-character pairing code and QR appear (`parentlock://pair?code=XXXXXX`). Codes expire in 24 hours.

**Child device**

1. Sign in (same auth providers; a different Firebase user).
2. Choose role **Child**.
3. Enter the pairing code or scan the parent QR.
4. Read the Family Controls explanation, then approve `.child` authorization (parent Apple ID confirms on this device).
5. In **Always allowed during Lock**, include Phone and ParentLock. Tokens are stored only in the App Group on this device.
6. Grant notification permission so lock commands can wake the app.

**Lock**

1. On the parent child-card, tap **Lock device**.
2. The Cloud Function writes a command, updates `devices/{id}.lockState`, and sends FCM (data + visible fallback).
3. The child applies `ManagedSettingsStore(named: "parentlock.lock")` with `applicationCategories = .all(except: alwaysAllowed)`.
4. If the child app was killed, tap the fallback notification “ParentLock needs to apply a lock”.

## 7. Common failures

| Symptom | Likely cause |
| --- | --- |
| Authorization sheet missing / `notAvailable` | Simulator, or Family Controls capability missing |
| `restricted` | Device is MDM-enrolled; Screen Time APIs are unavailable |
| Child can delete the app | Authorization used `.individual`, or approval never completed |
| Shields never appear | Command received but always-allowed selection is empty / includes everything; or entitlement not on the app |
| Silent push never arrives | Expected on iOS; use the visible notification + foreground Firestore listener |
| Functions reject pairing | Code expired, already redeemed past window, or caller is not a parent |

## 8. Privacy copy for App Store Review

> ParentLock does not read which apps a child uses. Screen Time tokens stay on the child device. The server stores only lock state, device metadata, and parent-issued commands. There is no location tracking and no social graph.

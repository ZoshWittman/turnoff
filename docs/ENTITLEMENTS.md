# Family Controls entitlements

ParentLock uses Apple Screen Time APIs. Those APIs require the **Family Controls** capability on the main app and on every Screen Time extension.

Development builds on registered devices can use the development Family Controls entitlement that Xcode adds with the capability. **TestFlight and App Store** require Apple to grant **Family Controls (Distribution)** for each bundle ID.

## Bundle IDs to request

Request distribution entitlement for all four of:

| Bundle ID | Target | Extension point |
| --- | --- | --- |
| `com.parentlock.app` | ParentLock | Main app (child applies `ManagedSettingsStore`) |
| `com.parentlock.app.monitor` | ParentLockMonitor | `com.apple.deviceactivity.monitor` |
| `com.parentlock.app.shieldconfig` | ParentLockShieldConfig | `com.apple.ManagedSettingsUI.shield-configuration` |
| `com.parentlock.app.shieldaction` | ParentLockShieldAction | `com.apple.ManagedSettings.shield-action` |

The notification service (`com.parentlock.app.notificationservice`) needs Push Notifications, not Family Controls.

Also create App Group `group.com.parentlock.shared` and enable it on every target, including the notification service.

## How to request

1. Sign in as Account Holder at [Apple Developer](https://developer.apple.com/account/).
2. Confirm the four App IDs exist (see [SETUP.md](SETUP.md)).
3. Open https://developer.apple.com/contact/request/family-controls-distribution
4. Submit a request. If the form accepts one bundle ID at a time, send four requests. If it accepts a list, include all four.

## Suggested form copy

**App name:** ParentLock

**Purpose:** ParentLock is a parental-control app. A parent in an iCloud Family Sharing group locks a child’s iPhone or iPad by sending a server command. The **child device** (authorized with `AuthorizationCenter.requestAuthorization(for: .child)`) applies `ManagedSettingsStore` shields so most apps are blocked until the parent unlocks. We do not use `.individual` for the child, because that authorization can be removed by the child.

**APIs used:**

- `FamilyControls` — `.child` authorization and `FamilyActivityPicker` for always-allowed apps (selected on the child device)
- `ManagedSettings` — named store `parentlock.lock`; `shield.applicationCategories = .all(except:)`
- `ManagedSettingsUI` — custom shield configuration and shield action (“Ask to unlock”)
- `DeviceActivity` — one-shot schedule `parentlock.timedUnlock` so a timed lock clears when `unlockAt` is reached

**Why each target needs the entitlement:**

- Main app: requests `.child` authorization, presents `FamilyActivityPicker`, applies and clears the named store when a parent command arrives.
- Device Activity Monitor: receives `intervalDidEnd` for `parentlock.timedUnlock` and clears the same named store.
- Shield Configuration: shows a calm, branded shield (“Locked by parent”) instead of the default Screen Time shield.
- Shield Action: the primary shield button writes an unlock request for the parent (App Group flag + local notification). It cannot disable the shield.

**What we do not do:**

- No MDM, no private APIs, no device shutdown, no location, no app-usage analytics uploaded to our servers.
- Opaque tokens (`ApplicationToken`, `ActivityCategoryToken`, `WebDomainToken`) stay on the child device in App Group storage. They are never sent to our backend.

**Family Sharing:** A parent/guardian in the same Family Sharing group must approve the authorization sheet on the child’s device. After approval, iOS prevents the child from deleting the app.

## After approval

1. In the developer portal, enable Family Controls on each App ID.
2. Regenerate provisioning profiles (Xcode “Automatically manage signing” is fine).
3. Confirm each target’s `.entitlements` file contains `com.apple.developer.family-controls`.
4. Archive and upload to TestFlight only after the distribution entitlement shows as approved for every Screen Time bundle ID. Missing it on one extension is a common rejection.

## Related capabilities (not the distribution form)

| Capability | Targets |
| --- | --- |
| App Groups (`group.com.parentlock.shared`) | All six targets |
| Push Notifications | App, notification service |
| Sign in with Apple | App |
| Background Modes: remote-notification, fetch | App |

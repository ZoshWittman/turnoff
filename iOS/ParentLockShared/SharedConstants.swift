import Foundation

/// Shared identifiers used by the app and every extension.
public enum ParentLockConstants {
    public static let appGroupId = "group.com.parentlock.shared"
    public static let bundlePrefix = "com.parentlock"
    public static let loggerSubsystem = "com.parentlock"
    public static let storeName = "parentlock.lock"
    public static let timedUnlockActivity = "parentlock.timedUnlock"
    public static let backgroundRefreshId = "com.parentlock.refresh"
    public static let urlScheme = "parentlock"
    public static let darwinUnlockRequest = "com.parentlock.unlockRequest"
    public static let darwinTimedUnlock = "com.parentlock.timedUnlock"
    public static let alwaysAllowedFile = "always-allowed.plist"
    public static let pendingCommandFile = "pending-command.json"
}

public enum SharedDefaultsKey {
    public static let lockApplied = "lockApplied"
    public static let lastCommandId = "lastCommandId"
    public static let pendingUnlockRequest = "pendingUnlockRequest"
    public static let pendingScheduleUnlock = "pendingScheduleUnlock"
    public static let deviceId = "deviceId"
    public static let familyId = "familyId"
    public static let unlockAt = "unlockAt"
    public static let lockStrategy = "lockStrategy"
}

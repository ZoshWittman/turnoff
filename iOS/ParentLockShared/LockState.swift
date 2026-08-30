import Foundation

/// Authoritative lock state mirrored from Firestore onto the child device.
public enum LockState: String, Codable, Sendable {
    case unlocked
    case locked
}

/// Who last requested the current lock.
public enum LockSource: String, Codable, Sendable {
    case parent
    case schedule
}

/// Command verbs issued by a parent (or the timed-unlock scheduler).
public enum CommandType: String, Codable, Sendable {
    case lock
    case unlock
    case lockUntil = "lock_until"
}

/// Delivery lifecycle for a server-issued command.
public enum CommandStatus: String, Codable, Sendable {
    case pending
    case delivered
    case applied
    case failed
}

/// How `ShieldService` maps a `FamilyActivitySelection` onto Managed Settings.
public enum ShieldStrategy: String, Codable, Sendable {
    /// Primary v1 path: shield every category except always-allowed application tokens.
    case categoriesAllExcept
    /// FUTURE: if `.all(except:)` is insufficient on a given iOS version, persist a
    /// second picker (“Apps to lock”) and set `store.shield.applications` plus
    /// `store.shield.applicationCategories = .specific(...)`.
    case explicitBlockList
}

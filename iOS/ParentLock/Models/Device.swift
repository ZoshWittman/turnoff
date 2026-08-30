import Foundation
import ParentLockShared

struct Device: Identifiable, Hashable, Sendable {
    var id: String
    var familyId: String
    var uid: String
    var role: UserRole
    var platform: String
    var pushToken: String?
    var name: String
    var lockState: LockState
    var lockSource: LockSource?
    var lockedAt: Date?
    var unlockAt: Date?
    var lastSeenAt: Date?
    var lastCommandId: String?

    var isChild: Bool { role == .child }

    var lastSeenLabel: String {
        guard let lastSeenAt else { return "Never seen" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: lastSeenAt, relativeTo: Date())
    }
}

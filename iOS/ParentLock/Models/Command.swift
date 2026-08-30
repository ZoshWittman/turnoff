import Foundation
import ParentLockShared

struct Command: Identifiable, Hashable, Sendable {
    var id: String
    var familyId: String
    var targetDeviceId: String
    var type: CommandType
    var requestedByUid: String
    var createdAt: Date?
    var expiresAt: Date?
    var status: CommandStatus
    var unlockAt: Date?
}

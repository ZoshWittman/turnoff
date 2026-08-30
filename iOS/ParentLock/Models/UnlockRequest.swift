import Foundation

enum UnlockRequestStatus: String, Codable, Sendable {
    case pending
    case approved
    case denied
}

struct UnlockRequest: Identifiable, Hashable, Sendable {
    var id: String
    var familyId: String
    var childDeviceId: String
    var childUid: String
    var status: UnlockRequestStatus
    var createdAt: Date?
}

import Foundation

struct Family: Identifiable, Hashable, Sendable {
    var id: String
    var ownerUid: String
    var pairingCode: String?
    var pairingCodeExpiresAt: Date?
    var createdAt: Date?
}

struct FamilyMember: Identifiable, Hashable, Sendable {
    var id: String
    var role: UserRole
    var displayName: String
}

struct PairingPayload: Equatable, Sendable {
    var familyId: String
    var code: String
    var expiresAt: Date
    var qrPayload: String
}

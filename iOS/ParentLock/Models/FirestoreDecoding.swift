import Foundation
import FirebaseFirestore
import ParentLockShared

enum FirestoreDecoding {
    static func date(_ value: Any?) -> Date? {
        if let timestamp = value as? Timestamp {
            return timestamp.dateValue()
        }
        if let date = value as? Date {
            return date
        }
        if let iso = value as? String {
            return ISO8601DateFormatter.parseParentLock(iso)
        }
        return nil
    }

    static func string(_ value: Any?) -> String? {
        value as? String
    }
}

extension Device {
    init?(id: String, data: [String: Any]) {
        guard let familyId = data["familyId"] as? String,
              let uid = data["uid"] as? String,
              let roleRaw = data["role"] as? String,
              let role = UserRole(rawValue: roleRaw)
        else { return nil }
        self.id = id
        self.familyId = familyId
        self.uid = uid
        self.role = role
        self.platform = (data["platform"] as? String) ?? "ios"
        self.pushToken = data["pushToken"] as? String
        self.name = (data["name"] as? String) ?? "Device"
        if let raw = data["lockState"] as? String, let state = LockState(rawValue: raw) {
            self.lockState = state
        } else {
            self.lockState = .unlocked
        }
        if let raw = data["lockSource"] as? String {
            self.lockSource = LockSource(rawValue: raw)
        } else {
            self.lockSource = nil
        }
        self.lockedAt = FirestoreDecoding.date(data["lockedAt"])
        self.unlockAt = FirestoreDecoding.date(data["unlockAt"])
        self.lastSeenAt = FirestoreDecoding.date(data["lastSeenAt"])
        self.lastCommandId = data["lastCommandId"] as? String
    }
}

extension Family {
    init(id: String, data: [String: Any]) {
        self.id = id
        self.ownerUid = (data["ownerUid"] as? String) ?? ""
        self.pairingCode = data["pairingCode"] as? String
        self.pairingCodeExpiresAt = FirestoreDecoding.date(data["pairingCodeExpiresAt"])
        self.createdAt = FirestoreDecoding.date(data["createdAt"])
    }
}

extension UnlockRequest {
    init?(id: String, data: [String: Any]) {
        guard let familyId = data["familyId"] as? String,
              let childDeviceId = data["childDeviceId"] as? String,
              let childUid = data["childUid"] as? String,
              let statusRaw = data["status"] as? String,
              let status = UnlockRequestStatus(rawValue: statusRaw)
        else { return nil }
        self.id = id
        self.familyId = familyId
        self.childDeviceId = childDeviceId
        self.childUid = childUid
        self.status = status
        self.createdAt = FirestoreDecoding.date(data["createdAt"])
    }
}

extension Command {
    init?(id: String, data: [String: Any]) {
        guard let familyId = data["familyId"] as? String,
              let targetDeviceId = data["targetDeviceId"] as? String,
              let typeRaw = data["type"] as? String,
              let type = CommandType(rawValue: typeRaw)
        else { return nil }
        self.id = id
        self.familyId = familyId
        self.targetDeviceId = targetDeviceId
        self.type = type
        self.requestedByUid = (data["requestedByUid"] as? String) ?? ""
        self.createdAt = FirestoreDecoding.date(data["createdAt"])
        self.expiresAt = FirestoreDecoding.date(data["expiresAt"])
        if let raw = data["status"] as? String, let status = CommandStatus(rawValue: raw) {
            self.status = status
        } else {
            self.status = .pending
        }
        self.unlockAt = FirestoreDecoding.date(data["unlockAt"])
    }
}

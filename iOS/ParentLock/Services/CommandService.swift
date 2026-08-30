import FirebaseFirestore
import FirebaseFunctions
import Foundation
import ParentLockShared

/// Parent command callables and child acknowledgement.
@MainActor
final class CommandService {
    private let functions: Functions
    private let firestore: Firestore
    private let log = ParentLockLog.category("command")

    init(functions: Functions = Functions.functions(), firestore: Firestore = Firestore.firestore()) {
        self.functions = functions
        self.firestore = firestore
    }

    /// Asks the server to lock, unlock, or time-lock a child device.
    func send(deviceId: String, type: CommandType, unlockAt: Date? = nil) async throws -> String {
        var payload: [String: Any] = [
            "targetDeviceId": deviceId,
            "type": type.rawValue,
        ]
        if let unlockAt {
            payload["unlockAt"] = ISO8601DateFormatter.parentLock.string(from: unlockAt)
        }
        let result = try await functions.httpsCallable("sendDeviceCommand").call(payload)
        guard let data = result.data as? [String: Any],
              let commandId = data["commandId"] as? String
        else {
            throw ParentLockError.commandFailed("The lock command was not accepted.")
        }
        log.info("Sent \(type.rawValue, privacy: .public) command \(commandId, privacy: .public)")
        return commandId
    }

    func requestUnlock(childDeviceId: String) async throws {
        _ = try await functions.httpsCallable("requestUnlock").call(["childDeviceId": childDeviceId])
        log.info("Unlock request sent for \(childDeviceId, privacy: .public)")
    }

    func resolveUnlockRequest(id: String, approve: Bool) async throws {
        _ = try await functions.httpsCallable("resolveUnlockRequest").call([
            "requestId": id,
            "decision": approve ? "approved" : "denied",
        ])
    }

    func acknowledge(commandId: String, status: CommandStatus) async throws {
        _ = try await functions.httpsCallable("acknowledgeCommand").call([
            "commandId": commandId,
            "status": status.rawValue,
        ])
    }

    func listenToUnlockRequests(familyId: String, onChange: @escaping ([UnlockRequest]) -> Void) -> ListenerRegistration {
        firestore.collection("unlockRequests")
            .whereField("familyId", isEqualTo: familyId)
            .whereField("status", isEqualTo: UnlockRequestStatus.pending.rawValue)
            .addSnapshotListener { snapshot, error in
                if let error {
                    ParentLockLog.category("command").error("Unlock inbox failed: \(error.localizedDescription, privacy: .public)")
                    return
                }
                let items = snapshot?.documents.compactMap { UnlockRequest(id: $0.documentID, data: $0.data()) } ?? []
                onChange(items.sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) })
            }
    }
}

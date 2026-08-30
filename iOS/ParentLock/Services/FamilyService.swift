import FirebaseFirestore
import FirebaseFunctions
import Foundation
import ParentLockShared

/// Family create / pairing callables and live family listeners.
@MainActor
final class FamilyService {
    private let functions: Functions
    private let firestore: Firestore
    private let log = ParentLockLog.category("family")

    init(functions: Functions = Functions.functions(), firestore: Firestore = Firestore.firestore()) {
        self.functions = functions
        self.firestore = firestore
    }

    /// Creates a family if needed and returns a 24-hour pairing code plus QR payload.
    func createPairingCode(familyId: String? = nil) async throws -> PairingPayload {
        var payload: [String: Any] = [:]
        if let familyId { payload["familyId"] = familyId }
        let result = try await functions.httpsCallable("createPairingCode").call(payload)
        guard let data = result.data as? [String: Any],
              let familyId = data["familyId"] as? String,
              let code = data["code"] as? String,
              let qr = data["qrPayload"] as? String
        else {
            throw ParentLockError.pairingFailed("The server did not return a pairing code.")
        }
        let expiresAt: Date
        if let iso = data["expiresAt"] as? String, let parsed = ISO8601DateFormatter.parseParentLock(iso) {
            expiresAt = parsed
        } else {
            expiresAt = Date().addingTimeInterval(24 * 60 * 60)
        }
        log.info("Created pairing code for family \(familyId, privacy: .public)")
        return PairingPayload(familyId: familyId, code: code, expiresAt: expiresAt, qrPayload: qr)
    }

    /// Redeems a parent pairing code and attaches this child account to the family.
    func redeemPairingCode(code: String, deviceName: String, pushToken: String?) async throws -> (familyId: String, deviceId: String) {
        var payload: [String: Any] = [
            "code": code,
            "deviceName": deviceName,
            "platform": "ios",
        ]
        if let pushToken { payload["pushToken"] = pushToken }
        let result = try await functions.httpsCallable("redeemPairingCode").call(payload)
        guard let data = result.data as? [String: Any],
              let familyId = data["familyId"] as? String,
              let deviceId = data["deviceId"] as? String
        else {
            throw ParentLockError.pairingFailed("Pairing did not return a device id.")
        }
        log.info("Redeemed pairing; device \(deviceId, privacy: .public)")
        return (familyId, deviceId)
    }

    func listenToFamily(id: String, onChange: @escaping (Family) -> Void) -> ListenerRegistration {
        firestore.collection("families").document(id).addSnapshotListener { snapshot, error in
            if let error {
                ParentLockLog.category("family").error("Family listen failed: \(error.localizedDescription, privacy: .public)")
                return
            }
            guard let snapshot, snapshot.exists, let data = snapshot.data() else { return }
            onChange(Family(id: snapshot.documentID, data: data))
        }
    }
}

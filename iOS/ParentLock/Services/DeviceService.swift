import FirebaseFirestore
import FirebaseFunctions
import Foundation
import ParentLockShared

/// Device registration, presence, and family device lists.
@MainActor
final class DeviceService {
    private let functions: Functions
    private let firestore: Firestore
    private let log = ParentLockLog.category("device")

    init(functions: Functions = Functions.functions(), firestore: Firestore = Firestore.firestore()) {
        self.functions = functions
        self.firestore = firestore
    }

    /// Registers this phone as a parent device or refreshes its FCM token.
    func register(deviceId: String?, familyId: String, role: UserRole, name: String, pushToken: String?) async throws -> String {
        var payload: [String: Any] = [
            "familyId": familyId,
            "role": role.rawValue,
            "name": name,
            "platform": "ios",
        ]
        if let deviceId { payload["deviceId"] = deviceId }
        if let pushToken { payload["pushToken"] = pushToken }
        let result = try await functions.httpsCallable("registerDeviceToken").call(payload)
        guard let data = result.data as? [String: Any],
              let id = data["deviceId"] as? String
        else {
            throw ParentLockError.commandFailed("Device registration failed.")
        }
        log.info("Registered device \(id, privacy: .public)")
        return id
    }

    func unpair(deviceId: String) async throws {
        _ = try await functions.httpsCallable("unpairDevice").call(["deviceId": deviceId])
    }

    func listenToFamilyDevices(familyId: String, onChange: @escaping ([Device]) -> Void) -> ListenerRegistration {
        firestore.collection("devices")
            .whereField("familyId", isEqualTo: familyId)
            .addSnapshotListener { snapshot, error in
                if let error {
                    ParentLockLog.category("device").error("Device list failed: \(error.localizedDescription, privacy: .public)")
                    return
                }
                let devices = snapshot?.documents.compactMap { Device(id: $0.documentID, data: $0.data()) } ?? []
                onChange(devices)
            }
    }

    func listenToDevice(id: String, onChange: @escaping (Device) -> Void) -> ListenerRegistration {
        firestore.collection("devices").document(id).addSnapshotListener { snapshot, error in
            if let error {
                ParentLockLog.category("device").error("Device listen failed: \(error.localizedDescription, privacy: .public)")
                return
            }
            guard let snapshot, let data = snapshot.data(), let device = Device(id: snapshot.documentID, data: data) else {
                return
            }
            onChange(device)
        }
    }
}

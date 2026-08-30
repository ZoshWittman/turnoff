import FirebaseMessaging
import Foundation
import ParentLockShared
import UIKit
import UserNotifications

/// Registers for APNs / FCM and keeps the token for the backend.
@MainActor
@Observable
final class PushService: NSObject {
    private(set) var fcmToken: String?
    private(set) var authorizationGranted = false
    private(set) var lastError: ParentLockError?
    var onCommandUserInfo: (([AnyHashable: Any]) -> Void)?

    private let log = ParentLockLog.category("push")

    /// Requests alert permission and registers for remote notifications.
    func requestAuthorization() async {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
            authorizationGranted = granted
            if !granted {
                lastError = .pushDenied
            }
            UIApplication.shared.registerForRemoteNotifications()
        } catch {
            lastError = .pushDenied
            log.error("Notification permission failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func applyFcmToken(_ token: String?) {
        fcmToken = token
    }

    func applyApnsToken(_ deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        log.info("APNs token registered (\(deviceToken.count) bytes)")
        Task { await refreshFcmToken() }
    }

    func refreshFcmToken() async {
        do {
            let token = try await Messaging.messaging().token()
            fcmToken = token
            log.info("FCM token refreshed")
        } catch {
            log.error("FCM token failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func handleNotificationUserInfo(_ userInfo: [AnyHashable: Any]) {
        if let command = PendingCommand(userInfo: userInfo) {
            AppGroupStore.shared.savePendingCommand(command)
        }
        onCommandUserInfo?(userInfo)
    }
}

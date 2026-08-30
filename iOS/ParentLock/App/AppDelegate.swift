import FirebaseCore
import FirebaseMessaging
import ParentLockShared
import UIKit
import UserNotifications

/// UIKit delegate for APNs, silent push, and Firebase Messaging.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    var environment: AppEnvironment?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        if FirebaseApp.app() == nil, AppEnvironment.detectFirebasePlist() {
            FirebaseApp.configure()
        }
        UNUserNotificationCenter.current().delegate = self
        Messaging.messaging().delegate = self
        BackgroundRefreshService.register { [weak self] in
            await self?.environment?.session.becomeActive()
        }
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            environment?.push.applyApnsToken(deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        ParentLockLog.category("push").error("APNs registration failed: \(error.localizedDescription, privacy: .public)")
    }

    /// Handles silent and visible remote notifications while the app is running.
    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        Task { @MainActor in
            environment?.push.handleNotificationUserInfo(userInfo)
            await environment?.session.handleIncomingCommand(userInfo)
            completionHandler(.newData)
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        await MainActor.run {
            environment?.push.handleNotificationUserInfo(userInfo)
        }
        await environment?.session.handleIncomingCommand(userInfo)
        if response.actionIdentifier == "APPROVE_UNLOCK",
           let requestId = userInfo["requestId"] as? String {
            await environment?.session.resolve(
                request: UnlockRequest(
                    id: requestId,
                    familyId: "",
                    childDeviceId: userInfo["childDeviceId"] as? String ?? "",
                    childUid: "",
                    status: .pending,
                    createdAt: Date()
                ),
                approve: true
            )
        }
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        Task { @MainActor in
            environment?.push.applyFcmToken(fcmToken)
            await environment?.session.refreshChildToken()
            await environment?.session.registerParentDeviceIfNeeded()
        }
    }
}

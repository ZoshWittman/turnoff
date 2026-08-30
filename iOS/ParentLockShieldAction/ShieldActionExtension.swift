import Foundation
import ManagedSettings
import ParentLockShared
import UserNotifications

/// Primary shield button writes an unlock-request flag; it cannot clear the lock.
final class ShieldActionExtension: ShieldActionDelegate {
    private let log = ParentLockLog.category("shieldaction")

    override func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        handle(action: action, completionHandler: completionHandler)
    }

    override func handle(action: ShieldAction, for webDomain: WebDomainToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        handle(action: action, completionHandler: completionHandler)
    }

    override func handle(action: ShieldAction, for category: ActivityCategoryToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        handle(action: action, completionHandler: completionHandler)
    }

    private func handle(action: ShieldAction, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        switch action {
        case .primaryButtonPressed:
            requestUnlock()
            completionHandler(.none)
        case .secondaryButtonPressed:
            completionHandler(.none)
        @unknown default:
            completionHandler(.none)
        }
    }

    private func requestUnlock() {
        let store = AppGroupStore.shared
        store.pendingUnlockRequest = true
        DarwinBridge.post(ParentLockConstants.darwinUnlockRequest)
        scheduleOpenAppNotification()
        log.info("Queued unlock request from shield")
    }

    /// Extensions cannot reliably hit the network; a local notification opens the child app.
    private func scheduleOpenAppNotification() {
        let content = UNMutableNotificationContent()
        content.title = "Ask to unlock"
        content.body = "Open ParentLock so your parent can see this request."
        content.sound = .default
        let request = UNNotificationRequest(
            identifier: "parentlock.unlock-request",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )
        UNUserNotificationCenter.current().add(request)
    }
}

import ParentLockShared
import UserNotifications

/// Writes incoming lock commands into the App Group when a visible notification arrives.
final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttempt = (request.content.mutableCopy() as? UNMutableNotificationContent)
        if let command = PendingCommand(userInfo: request.content.userInfo) {
            AppGroupStore.shared.savePendingCommand(command)
        }
        contentHandler(bestAttempt ?? request.content)
    }

    override func serviceExtensionTimeWillExpire() {
        if let contentHandler, let bestAttempt {
            contentHandler(bestAttempt)
        }
    }
}

import Foundation

/// Posts Darwin notifications so the main app can notice extension-side flags.
/// Observers should also poll `AppGroupStore` on foreground; Darwin is best-effort.
public enum DarwinBridge {
    /// Broadcasts a notify-name that other processes in the App Group can observe.
    public static func post(_ name: String) {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterPostNotification(
            center,
            CFNotificationName(name as CFString),
            nil,
            nil,
            true
        )
    }
}

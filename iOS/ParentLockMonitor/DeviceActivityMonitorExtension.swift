import DeviceActivity
import Foundation
import ParentLockShared

/// Clears the ParentLock store when a timed lock interval ends.
final class DeviceActivityMonitorExtension: DeviceActivityMonitor {
    private let log = ParentLockLog.category("monitor")

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        guard activity.rawValue == ParentLockConstants.timedUnlockActivity else { return }
        ShieldService.shared.clearLock()
        let store = AppGroupStore.shared
        store.pendingScheduleUnlock = true
        store.unlockAt = nil
        DarwinBridge.post(ParentLockConstants.darwinTimedUnlock)
        log.info("Timed unlock interval ended")
    }
}

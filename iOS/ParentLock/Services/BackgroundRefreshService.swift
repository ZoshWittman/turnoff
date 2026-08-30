import BackgroundTasks
import Foundation
import ParentLockShared

/// Registers `BGAppRefreshTask` so a child can poll lock state if push is delayed.
enum BackgroundRefreshService {
    static func register(handler: @escaping () async -> Void) {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: ParentLockConstants.backgroundRefreshId,
            using: nil
        ) { task in
            schedule()
            Task {
                await handler()
                task.setTaskCompleted(success: true)
            }
        }
    }

    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: ParentLockConstants.backgroundRefreshId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            ParentLockLog.category("refresh").error("BGAppRefresh submit failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}

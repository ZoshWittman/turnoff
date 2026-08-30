import Foundation
#if canImport(DeviceActivity)
import DeviceActivity
#endif

/// Starts or cancels the one-shot `parentlock.timedUnlock` Device Activity schedule.
public struct TimedUnlockScheduler: Sendable {
    public static let shared = TimedUnlockScheduler()
    private let log = ParentLockLog.category("schedule")

    public init() {}

#if canImport(DeviceActivity)
    private var center: DeviceActivityCenter { DeviceActivityCenter() }
    private var name: DeviceActivityName { DeviceActivityName(ParentLockConstants.timedUnlockActivity) }

    /// Registers a non-repeating interval from now until `unlockAt`.
    public func start(unlockAt: Date) throws {
        let calendar = Calendar.current
        let start = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: Date()
        )
        let end = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: unlockAt
        )
        let schedule = DeviceActivitySchedule(
            intervalStart: start,
            intervalEnd: end,
            repeats: false
        )
        try center.startMonitoring(name, during: schedule)
        log.info("Started timed unlock for \(unlockAt.timeIntervalSince1970, privacy: .public)")
    }

    public func cancel() {
        center.stopMonitoring([name])
        log.info("Cancelled timed unlock schedule")
    }
#else
    public func start(unlockAt: Date) throws {}
    public func cancel() {}
#endif
}

import Foundation
import ParentLockShared

/// Applies or clears shields when a parent command is seen on the child device.
@MainActor
final class CommandApplier {
    private let shield: ShieldService
    private let scheduler: TimedUnlockScheduler
    private let store: AppGroupStore
    private let commands: CommandService
    private let log = ParentLockLog.category("applier")

    init(
        shield: ShieldService = .shared,
        scheduler: TimedUnlockScheduler = .shared,
        store: AppGroupStore = .shared,
        commands: CommandService
    ) {
        self.shield = shield
        self.scheduler = scheduler
        self.store = store
        self.commands = commands
    }

    /// Deduplicates by command id, then applies or clears the named store synchronously.
    func apply(_ command: PendingCommand) async {
        if store.lastCommandId == command.commandId, command.type != .unlock {
            log.info("Skipping duplicate command \(command.commandId, privacy: .public)")
            return
        }
        store.savePendingCommand(command)
        do {
            switch command.type {
            case .lock, .lockUntil:
                guard shield.applyPersistedLock() else {
                    try await commands.acknowledge(commandId: command.commandId, status: .failed)
                    return
                }
                if command.type == .lockUntil, let unlockAt = command.unlockAt {
                    try scheduler.start(unlockAt: unlockAt)
                    store.unlockAt = unlockAt
                } else {
                    scheduler.cancel()
                }
            case .unlock:
                shield.clearLock()
                scheduler.cancel()
            }
            store.lastCommandId = command.commandId
            store.clearPendingCommand()
            try await commands.acknowledge(commandId: command.commandId, status: .applied)
            log.info("Applied command \(command.commandId, privacy: .public)")
        } catch {
            log.error("Apply failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Reconciles local shields with the server’s desired lock state (foreground / refresh).
    func reconcile(device: Device) async {
        switch device.lockState {
        case .locked:
            if !shield.currentLockApplied {
                _ = shield.applyPersistedLock()
            }
            if let commandId = device.lastCommandId, store.lastCommandId != commandId {
                let type: CommandType = device.unlockAt == nil ? .lock : .lockUntil
                await apply(PendingCommand(commandId: commandId, type: type, unlockAt: device.unlockAt))
            }
        case .unlocked:
            if shield.currentLockApplied {
                shield.clearLock()
                scheduler.cancel()
            }
        }
    }

    func flushPendingUnlockRequest() async {
        guard store.pendingUnlockRequest, let deviceId = store.deviceId else { return }
        do {
            try await commands.requestUnlock(childDeviceId: deviceId)
            store.pendingUnlockRequest = false
        } catch {
            log.error("Unlock request flush failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}

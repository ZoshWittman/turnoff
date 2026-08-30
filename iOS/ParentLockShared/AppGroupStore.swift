import Foundation

/// App Group `UserDefaults` plus small files for tokens and pending commands.
public final class AppGroupStore: @unchecked Sendable {
    public static let shared = AppGroupStore()

    private let defaults: UserDefaults
    private let containerURL: URL?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let log = ParentLockLog.category("appgroup")

    public init(
        defaults: UserDefaults? = UserDefaults(suiteName: ParentLockConstants.appGroupId),
        containerURL: URL? = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: ParentLockConstants.appGroupId
        )
    ) {
        self.defaults = defaults ?? UserDefaults.standard
        self.containerURL = containerURL
    }

    public var lockApplied: Bool {
        get { defaults.bool(forKey: SharedDefaultsKey.lockApplied) }
        set { defaults.set(newValue, forKey: SharedDefaultsKey.lockApplied) }
    }

    public var lastCommandId: String? {
        get { defaults.string(forKey: SharedDefaultsKey.lastCommandId) }
        set { defaults.set(newValue, forKey: SharedDefaultsKey.lastCommandId) }
    }

    public var pendingUnlockRequest: Bool {
        get { defaults.bool(forKey: SharedDefaultsKey.pendingUnlockRequest) }
        set { defaults.set(newValue, forKey: SharedDefaultsKey.pendingUnlockRequest) }
    }

    public var pendingScheduleUnlock: Bool {
        get { defaults.bool(forKey: SharedDefaultsKey.pendingScheduleUnlock) }
        set { defaults.set(newValue, forKey: SharedDefaultsKey.pendingScheduleUnlock) }
    }

    public var deviceId: String? {
        get { defaults.string(forKey: SharedDefaultsKey.deviceId) }
        set { defaults.set(newValue, forKey: SharedDefaultsKey.deviceId) }
    }

    public var familyId: String? {
        get { defaults.string(forKey: SharedDefaultsKey.familyId) }
        set { defaults.set(newValue, forKey: SharedDefaultsKey.familyId) }
    }

    public var unlockAt: Date? {
        get {
            let interval = defaults.double(forKey: SharedDefaultsKey.unlockAt)
            return interval > 0 ? Date(timeIntervalSince1970: interval) : nil
        }
        set {
            if let newValue {
                defaults.set(newValue.timeIntervalSince1970, forKey: SharedDefaultsKey.unlockAt)
            } else {
                defaults.removeObject(forKey: SharedDefaultsKey.unlockAt)
            }
        }
    }

    public var strategy: ShieldStrategy {
        get {
            if let raw = defaults.string(forKey: SharedDefaultsKey.lockStrategy),
               let value = ShieldStrategy(rawValue: raw) {
                return value
            }
            return .categoriesAllExcept
        }
        set { defaults.set(newValue.rawValue, forKey: SharedDefaultsKey.lockStrategy) }
    }

    /// Writes a pending command so a later launch or extension can apply it.
    public func savePendingCommand(_ command: PendingCommand) {
        guard let url = fileURL(ParentLockConstants.pendingCommandFile) else { return }
        do {
            let data = try encoder.encode(command)
            try data.write(to: url, options: .atomic)
            lastCommandId = command.commandId
            unlockAt = command.unlockAt
        } catch {
            log.error("Failed to persist pending command: \(error.localizedDescription, privacy: .public)")
        }
    }

    public func loadPendingCommand() -> PendingCommand? {
        guard let url = fileURL(ParentLockConstants.pendingCommandFile),
              FileManager.default.fileExists(atPath: url.path)
        else { return nil }
        do {
            let data = try Data(contentsOf: url)
            return try decoder.decode(PendingCommand.self, from: data)
        } catch {
            log.error("Failed to load pending command: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    public func clearPendingCommand() {
        if let url = fileURL(ParentLockConstants.pendingCommandFile) {
            try? FileManager.default.removeItem(at: url)
        }
    }

    /// Persists opaque Family Controls tokens on the child device only.
    public func saveSelectionData(_ data: Data) {
        guard let url = fileURL(ParentLockConstants.alwaysAllowedFile) else { return }
        do {
            try data.write(to: url, options: .atomic)
        } catch {
            log.error("Failed to persist selection: \(error.localizedDescription, privacy: .public)")
        }
    }

    public func loadSelectionData() -> Data? {
        guard let url = fileURL(ParentLockConstants.alwaysAllowedFile),
              FileManager.default.fileExists(atPath: url.path)
        else { return nil }
        return try? Data(contentsOf: url)
    }

    public func hasSelection() -> Bool {
        loadSelectionData() != nil
    }

    private func fileURL(_ name: String) -> URL? {
        containerURL?.appendingPathComponent(name)
    }
}

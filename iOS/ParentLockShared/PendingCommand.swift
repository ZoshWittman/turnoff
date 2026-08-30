import Foundation

/// Command snapshot stored in the App Group so extensions and the main app agree.
public struct PendingCommand: Codable, Equatable, Sendable {
    public var commandId: String
    public var type: CommandType
    public var unlockAt: Date?

    public init(commandId: String, type: CommandType, unlockAt: Date?) {
        self.commandId = commandId
        self.type = type
        self.unlockAt = unlockAt
    }

    public init?(userInfo: [AnyHashable: Any]) {
        guard let typeRaw = userInfo["type"] as? String,
              let type = CommandType(rawValue: typeRaw),
              let commandId = userInfo["commandId"] as? String,
              !commandId.isEmpty
        else {
            return nil
        }
        self.commandId = commandId
        self.type = type
        if let iso = userInfo["unlockAt"] as? String, !iso.isEmpty {
            self.unlockAt = ISO8601DateFormatter.parentLock.date(from: iso)
        } else {
            self.unlockAt = nil
        }
    }
}

public extension ISO8601DateFormatter {
    static let parentLock: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let parentLockFallback: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}

public extension ISO8601DateFormatter {
    static func parseParentLock(_ value: String) -> Date? {
        parentLock.date(from: value) ?? parentLockFallback.date(from: value)
    }
}

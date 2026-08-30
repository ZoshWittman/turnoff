import Foundation
import os

/// Process-wide logger factory. Subsystem is always `com.parentlock`.
public enum ParentLockLog {
    public static func category(_ name: String) -> Logger {
        Logger(subsystem: ParentLockConstants.loggerSubsystem, category: name)
    }
}

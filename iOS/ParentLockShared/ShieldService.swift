import Foundation
#if canImport(ManagedSettings)
import FamilyControls
import ManagedSettings
#endif

/// Applies and clears the named ParentLock `ManagedSettingsStore` on the child device.
public final class ShieldService: @unchecked Sendable {
    public static let shared = ShieldService()

    private let storeName = ParentLockConstants.storeName
    private let appGroup: AppGroupStore
    private let selectionStore: FamilySelectionStore
    private let log = ParentLockLog.category("shield")

    public init(
        appGroup: AppGroupStore = .shared,
        selectionStore: FamilySelectionStore = FamilySelectionStore()
    ) {
        self.appGroup = appGroup
        self.selectionStore = selectionStore
    }

    /// Whether the named store currently has a lock recorded by this process.
    public var currentLockApplied: Bool {
        appGroup.lockApplied
    }

#if canImport(ManagedSettings)
    private var store: ManagedSettingsStore {
        ManagedSettingsStore(named: .init(storeName))
    }

    /// Shields every application category except the child’s always-allowed tokens.
    public func applyLock(except alwaysAllowed: FamilyActivitySelection) {
        let strategy = appGroup.strategy
        switch strategy {
        case .categoriesAllExcept:
            applyCategoriesAllExcept(alwaysAllowed)
        case .explicitBlockList:
            // FUTURE: `.all(except:)` has been insufficient on some iOS builds.
            // Persist a second FamilyActivitySelection of apps-to-block and call
            // `store.shield.applications` + `store.shield.applicationCategories = .specific(...)`.
            // Until that picker exists, fall back to the primary strategy.
            applyCategoriesAllExcept(alwaysAllowed)
        }
        appGroup.lockApplied = true
        log.info("Applied lock with strategy \(strategy.rawValue, privacy: .public)")
    }

    /// Applies the locally persisted always-allowed selection, if one exists.
    @discardableResult
    public func applyPersistedLock() -> Bool {
        guard let selection = selectionStore.load() else {
            log.error("No always-allowed selection on device; refuse to shield everything blindly")
            return false
        }
        applyLock(except: selection)
        return true
    }

    /// Clears the named store so apps are usable again.
    public func clearLock() {
        store.shield.applicationCategories = nil
        store.shield.applications = nil
        store.shield.webDomains = nil
        store.clearAllSettings()
        appGroup.lockApplied = false
        appGroup.unlockAt = nil
        log.info("Cleared ParentLock shields")
    }

    private func applyCategoriesAllExcept(_ selection: FamilyActivitySelection) {
        store.shield.applicationCategories = .all(except: selection.applicationTokens)
        if !selection.categoryTokens.isEmpty {
            // Categories in the always-allowed picker are reserved for a future allow-list.
            // The lock itself remains `.all(except: applicationTokens)`.
        }
        if selection.webDomainTokens.isEmpty {
            store.shield.webDomains = nil
        } else {
            store.shield.webDomains = selection.webDomainTokens
        }
    }
#else
    public func applyPersistedLock() -> Bool { false }
    public func clearLock() { appGroup.lockApplied = false }
#endif
}

import Foundation
import ParentLockShared
#if canImport(FamilyControls)
import FamilyControls
#endif

/// Child-side Family Controls authorization and always-allowed persistence.
@MainActor
@Observable
final class FamilyControlsService {
    private(set) var statusDescription: String = "Unknown"
    private(set) var isAuthorized = false
    private(set) var hasSelection = false
    private(set) var lastError: ParentLockError?
    private let selectionStore = FamilySelectionStore()
    private let log = ParentLockLog.category("familycontrols")

#if canImport(FamilyControls)
    /// Requests `.child` authorization. A parent in Family Sharing must approve the sheet.
    func requestChildAuthorization() async {
        lastError = nil
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .child)
            refreshStatus()
            log.info("Child authorization finished with status \(self.statusDescription, privacy: .public)")
        } catch {
            mapAuthorizationError(error)
            log.error("Child authorization failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func refreshStatus() {
        hasSelection = selectionStore.hasSelection()
        switch AuthorizationCenter.shared.authorizationStatus {
        case .approved:
            isAuthorized = true
            statusDescription = "Approved"
            lastError = nil
        case .denied:
            isAuthorized = false
            statusDescription = "Denied"
            lastError = .authorizationDenied
        case .notDetermined:
            isAuthorized = false
            statusDescription = "Not determined"
        @unknown default:
            isAuthorized = false
            statusDescription = "Unknown"
        }
    }

    func persist(_ selection: FamilyActivitySelection) throws {
        try selectionStore.save(selection)
        hasSelection = true
    }

    func loadSelection() -> FamilyActivitySelection? {
        selectionStore.load()
    }
#else
    func requestChildAuthorization() async {
        lastError = .authorizationUnavailable
        isAuthorized = false
    }

    func refreshStatus() {
        hasSelection = selectionStore.hasSelection()
        statusDescription = "Unavailable"
        lastError = .authorizationUnavailable
    }
#endif

    var hasPersistedSelection: Bool {
        selectionStore.hasSelection()
    }

    private func mapAuthorizationError(_ error: Error) {
#if canImport(FamilyControls)
        if let familyError = error as? FamilyControlsError {
            switch familyError {
            case .restricted:
                lastError = .authorizationRestricted
            default:
                lastError = .authorizationDenied
            }
            return
        }
#endif
        lastError = .authorizationUnavailable
    }
}

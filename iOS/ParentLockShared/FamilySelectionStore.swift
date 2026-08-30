import Foundation
#if canImport(FamilyControls)
import FamilyControls
#endif

/// Loads and saves the child’s always-allowed `FamilyActivitySelection` in the App Group.
public struct FamilySelectionStore: Sendable {
    private let store: AppGroupStore

    public init(store: AppGroupStore = .shared) {
        self.store = store
    }

#if canImport(FamilyControls)
    /// Encodes opaque tokens with a property list — they must never leave this device.
    public func save(_ selection: FamilyActivitySelection) throws {
        let data = try PropertyListEncoder().encode(selection)
        store.saveSelectionData(data)
    }

    public func load() -> FamilyActivitySelection? {
        guard let data = store.loadSelectionData() else { return nil }
        return try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
    }
#endif

    public func hasSelection() -> Bool {
        store.hasSelection()
    }
}

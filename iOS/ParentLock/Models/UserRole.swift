import Foundation

enum UserRole: String, Codable, CaseIterable, Identifiable, Sendable {
    case parent
    case child

    var id: String { rawValue }

    var title: String {
        switch self {
        case .parent: return "Parent"
        case .child: return "Child"
        }
    }

    var subtitle: String {
        switch self {
        case .parent:
            return "Pair with a child’s device and send Lock or Unlock."
        case .child:
            return "This iPhone or iPad will apply shields when a parent locks it."
        }
    }
}

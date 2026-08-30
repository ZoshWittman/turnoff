import Foundation

enum ParentLockError: LocalizedError, Equatable {
    case firebasePlistMissing
    case notSignedIn
    case pairingCodeInvalid
    case pairingFailed(String)
    case commandFailed(String)
    case authorizationDenied
    case authorizationRestricted
    case authorizationUnavailable
    case selectionMissing
    case pushDenied

    var errorDescription: String? {
        switch self {
        case .firebasePlistMissing:
            return "Add GoogleService-Info.plist from your Firebase project before running on a device."
        case .notSignedIn:
            return "Sign in to continue."
        case .pairingCodeInvalid:
            return "Enter the 6-character pairing code from the parent’s phone."
        case .pairingFailed(let message), .commandFailed(let message):
            return message
        case .authorizationDenied:
            return "Family Controls authorization was declined. A parent in Family Sharing must approve ParentLock on this device."
        case .authorizationRestricted:
            return "This device is managed (MDM). Screen Time APIs are unavailable, so ParentLock cannot apply shields."
        case .authorizationUnavailable:
            return "Family Controls is not available. Run on a real device signed into iCloud, not Simulator."
        case .selectionMissing:
            return "Choose at least Phone and ParentLock as always-allowed apps before locking."
        case .pushDenied:
            return "Notifications are off. ParentLock can still lock when this app is open, but background delivery will be delayed."
        }
    }
}

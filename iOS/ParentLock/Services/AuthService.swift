import AuthenticationServices
import CryptoKit
import FirebaseAuth
import Foundation
import ParentLockShared

/// Email/password and Sign in with Apple via Firebase Auth.
@MainActor
@Observable
final class AuthService {
    private(set) var user: User?
    private(set) var isConfigured: Bool
    var lastError: String?

    private var handle: AuthStateDidChangeListenerHandle?
    private var currentNonce: String?
    private let log = ParentLockLog.category("auth")

    init(isConfigured: Bool) {
        self.isConfigured = isConfigured
        guard isConfigured else { return }
        user = Auth.auth().currentUser
        handle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                self?.user = user
            }
        }
    }

    deinit {
        if let handle {
            Auth.auth().removeStateDidChangeListener(handle)
        }
    }

    /// Creates an email/password account and signs in.
    func signUp(email: String, password: String) async throws {
        try requireConfigured()
        let result = try await Auth.auth().createUser(withEmail: email, password: password)
        user = result.user
        log.info("Signed up \(result.user.uid, privacy: .public)")
    }

    /// Signs in with email and password.
    func signIn(email: String, password: String) async throws {
        try requireConfigured()
        let result = try await Auth.auth().signIn(withEmail: email, password: password)
        user = result.user
        log.info("Signed in \(result.user.uid, privacy: .public)")
    }

    /// Starts Sign in with Apple and returns the request nonce for the delegate.
    func prepareAppleRequest(_ request: ASAuthorizationAppleIDRequest) {
        let nonce = Self.randomNonce()
        currentNonce = nonce
        request.requestedScopes = [.fullName, .email]
        request.nonce = Self.sha256(nonce)
    }

    /// Completes Sign in with Apple against Firebase.
    func handleApple(authorization: ASAuthorization) async throws {
        try requireConfigured()
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let idToken = String(data: tokenData, encoding: .utf8),
              let nonce = currentNonce
        else {
            throw ParentLockError.commandFailed("Sign in with Apple did not return a token.")
        }
        let firebaseCredential = OAuthProvider.appleCredential(
            withIDToken: idToken,
            rawNonce: nonce,
            fullName: credential.fullName
        )
        let result = try await Auth.auth().signIn(with: firebaseCredential)
        user = result.user
        currentNonce = nil
        log.info("Signed in with Apple \(result.user.uid, privacy: .public)")
    }

    /// Signs out of Firebase. Child accounts authorized as `.child` may be blocked by iOS from iCloud sign-out.
    func signOut() throws {
        try Auth.auth().signOut()
        user = nil
    }

    var uid: String? { user?.uid }
    var email: String? { user?.email }
    var displayName: String {
        if let name = user?.displayName, !name.isEmpty { return name }
        if let email = user?.email, let prefix = email.split(separator: "@").first {
            return String(prefix)
        }
        return "Family member"
    }

    private func requireConfigured() throws {
        guard isConfigured else { throw ParentLockError.firebasePlistMissing }
    }

    private static func randomNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            var random: UInt8 = 0
            let status = SecRandomCopyBytes(kSecRandomDefault, 1, &random)
            if status != errSecSuccess {
                random = UInt8.random(in: 0...255)
            }
            if random < charset.count {
                result.append(charset[Int(random)])
                remaining -= 1
            } else if random < charset.count * (256 / charset.count) {
                result.append(charset[Int(random) % charset.count])
                remaining -= 1
            }
        }
        return result
    }

    private static func sha256(_ input: String) -> String {
        let data = Data(input.utf8)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}

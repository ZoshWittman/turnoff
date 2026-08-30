import Foundation
import ParentLockShared

/// Process-wide services created once at launch.
@MainActor
@Observable
final class AppEnvironment {
    let isFirebaseConfigured: Bool
    let auth: AuthService
    let familyControls: FamilyControlsService
    let push: PushService
    let session: SessionStore

    init(isFirebaseConfigured: Bool) {
        self.isFirebaseConfigured = isFirebaseConfigured
        let auth = AuthService(isConfigured: isFirebaseConfigured)
        let familyControls = FamilyControlsService()
        let push = PushService()
        let familyService = FamilyService()
        let deviceService = DeviceService()
        let commandService = CommandService()
        self.auth = auth
        self.familyControls = familyControls
        self.push = push
        self.session = SessionStore(
            familyService: familyService,
            deviceService: deviceService,
            commandService: commandService,
            familyControls: familyControls,
            push: push
        )
        push.onCommandUserInfo = { [session] userInfo in
            Task { @MainActor in
                await session.handleIncomingCommand(userInfo)
            }
        }
    }

    static func detectFirebasePlist() -> Bool {
        Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil
    }
}

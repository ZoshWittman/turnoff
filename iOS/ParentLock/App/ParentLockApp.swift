import FirebaseCore
import SwiftUI

@main
struct ParentLockApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var environment: AppEnvironment

    init() {
        let configured = AppEnvironment.detectFirebasePlist()
        if configured, FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
        _environment = State(initialValue: AppEnvironment(isFirebaseConfigured: configured))
    }

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environment(environment)
                .onAppear {
                    appDelegate.environment = environment
                }
                .onOpenURL { url in
                    handle(url: url)
                }
        }
    }

    private func handle(url: URL) {
        guard url.scheme == "parentlock" else { return }
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
        if let code = items?.first(where: { $0.name == "code" })?.value {
            Task { await environment.session.redeem(code: code) }
        }
    }
}

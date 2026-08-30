import SwiftUI

/// Root navigation: auth → role → parent home or child setup/home.
struct AppRootView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if !environment.isFirebaseConfigured {
                MissingFirebaseView()
            } else if environment.auth.user == nil {
                SignInView()
            } else if environment.session.role == nil {
                RolePickerView()
            } else if environment.session.role == .parent {
                ParentHomeView()
            } else {
                ChildGateView()
            }
        }
        .tint(Color.accentColor)
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await environment.session.becomeActive() }
            }
        }
        .onChange(of: environment.auth.user?.uid) { _, _ in
            environment.session.startListening()
        }
    }
}

struct ChildGateView: View {
    @Environment(AppEnvironment.self) private var environment

    var body: some View {
        Group {
            if environment.session.familyId == nil || environment.session.deviceId == nil {
                RedeemCodeView()
            } else if !environment.familyControls.isAuthorized {
                FamilyAuthView()
            } else if !environment.familyControls.hasSelection {
                AlwaysAllowedPickerView()
            } else {
                ChildHomeView()
            }
        }
        .onAppear {
            environment.familyControls.refreshStatus()
        }
    }
}

struct MissingFirebaseView: View {
    var body: some View {
        ContentUnavailableView(
            "Firebase not configured",
            systemImage: "flame",
            description: Text("Add GoogleService-Info.plist from your Firebase project to iOS/ParentLock. See docs/SETUP.md.")
        )
        .padding()
    }
}

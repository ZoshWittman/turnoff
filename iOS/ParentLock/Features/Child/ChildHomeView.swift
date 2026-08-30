import ParentLockShared
import SwiftUI

struct ChildHomeView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var showSettings = false

    private var state: LockState {
        environment.session.childDevice?.lockState ?? (ShieldService.shared.currentLockApplied ? .locked : .unlocked)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                StatusPill(state: state)
                    .scaleEffect(1.2)
                if state == .locked {
                    Text("Your parent paused this iPhone. You can still use allowed apps and the Phone app.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                    if let unlockAt = environment.session.childDevice?.unlockAt {
                        Text("Unlocks \(unlockAt.formatted(date: .omitted, time: .shortened))")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    UnlockRequestButton()
                } else {
                    Text("This device is unlocked. A parent can lock it from their iPhone.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                }
                if let banner = environment.session.banner {
                    ErrorBanner(message: banner)
                }
                if let pushError = environment.push.lastError {
                    ErrorBanner(message: pushError.localizedDescription)
                }
                Spacer()
            }
            .padding()
            .navigationTitle("ParentLock")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityLabel("Settings")
                }
            }
            .sheet(isPresented: $showSettings) {
                ChildSettingsView()
            }
            .task {
                environment.session.startListening()
                environment.familyControls.refreshStatus()
                await environment.push.requestAuthorization()
                await environment.session.refreshChildToken()
                await environment.session.becomeActive()
            }
        }
    }
}

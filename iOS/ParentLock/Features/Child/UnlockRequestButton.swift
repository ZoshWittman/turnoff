import SwiftUI

struct UnlockRequestButton: View {
    @Environment(AppEnvironment.self) private var environment

    var body: some View {
        Button("Ask to unlock") {
            Task { await environment.session.askToUnlock() }
        }
        .buttonStyle(.borderedProminent)
        .accessibilityHint("Sends a request to your parent. This does not unlock the device yourself.")
    }
}

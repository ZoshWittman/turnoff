import SwiftUI

struct FamilyAuthView: View {
    @Environment(AppEnvironment.self) private var environment

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                Text("A parent in Family Sharing must approve this.")
                    .font(.title2.weight(.semibold))
                Text("ParentLock uses Apple Screen Time on this device. The approval sheet is shown by iOS. After a parent or guardian in your Family Sharing group approves it, this app cannot be deleted and most apps can be shielded when they tap Lock.")
                    .foregroundStyle(.secondary)
                Text("Do not use a self-control / individual authorization. This device must be authorized as a child.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let error = environment.familyControls.lastError {
                    ErrorBanner(message: error.localizedDescription)
                }
                Button("Continue") {
                    Task { await environment.familyControls.requestChildAuthorization() }
                }
                .buttonStyle(.borderedProminent)
                Spacer()
            }
            .padding()
            .navigationTitle("Family Controls")
            .onAppear {
                environment.familyControls.refreshStatus()
            }
        }
    }
}

import SwiftUI

struct ParentSettingsView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    LabeledContent("Signed in as", value: environment.auth.email ?? environment.auth.displayName)
                    Button("Sign out", role: .destructive) {
                        try? environment.auth.signOut()
                        environment.session.resetLocalSession()
                        dismiss()
                    }
                }
                Section("Child devices") {
                    if environment.session.childDevices.isEmpty {
                        Text("None paired yet.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(environment.session.childDevices) { device in
                            Button("Unpair \(device.name)", role: .destructive) {
                                Task { await environment.session.unpair(device) }
                            }
                        }
                    }
                }
                Section("Privacy") {
                    Text("ParentLock does not read which apps the child uses. Screen Time tokens stay on the child’s device. The server stores lock state, device metadata, and commands only. No location.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

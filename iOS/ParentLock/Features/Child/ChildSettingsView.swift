import SwiftUI

struct ChildSettingsView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("This device") {
                    LabeledContent("Family Controls", value: environment.familyControls.statusDescription)
                    LabeledContent("Device id", value: environment.session.deviceId ?? "—")
                }
                Section("Always allowed") {
                    AlwaysAllowedPickerView()
                        .frame(minHeight: 280)
                        .listRowInsets(EdgeInsets())
                }
                Section {
                    Text("After Family Controls is approved for a child, iOS may prevent signing out of iCloud or deleting ParentLock. That is an Apple restriction, not a ParentLock setting.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Button("Sign out", role: .destructive) {
                        try? environment.auth.signOut()
                        environment.session.resetLocalSession()
                        dismiss()
                    }
                }
                Section("Privacy") {
                    Text("We do not read which apps you use. Tokens stay on this device.")
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

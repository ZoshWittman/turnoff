import SwiftUI
#if canImport(FamilyControls)
import FamilyControls
#endif

struct AlwaysAllowedPickerView: View {
    @Environment(AppEnvironment.self) private var environment
#if canImport(FamilyControls)
    @State private var selection = FamilyActivitySelection()
    @State private var isPickerPresented = false
#endif
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Always allowed during Lock")
                    .font(.title2.weight(.semibold))
                Text("Choose apps that stay available when a parent locks this device. Include Phone so you can still call, and include ParentLock so you can ask to unlock.")
                    .foregroundStyle(.secondary)
                Text("Some system apps cannot be shielded. Emergency calling always remains available.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
#if canImport(FamilyControls)
                Button("Choose always-allowed apps") {
                    isPickerPresented = true
                }
                .buttonStyle(.borderedProminent)
                Button("Save and continue") {
                    save()
                }
                .disabled(selection.applicationTokens.isEmpty && selection.categoryTokens.isEmpty)
                .familyActivityPicker(
                    title: Text("Always allowed during Lock"),
                    isPresented: $isPickerPresented,
                    selection: $selection
                )
#else
                Text("Family Controls is not available in this build.")
#endif
                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                }
                Spacer()
            }
            .padding()
            .navigationTitle("Allowed apps")
            .task {
                await environment.push.requestAuthorization()
            }
        }
    }

#if canImport(FamilyControls)
    private func save() {
        do {
            try environment.familyControls.persist(selection)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
#endif
}

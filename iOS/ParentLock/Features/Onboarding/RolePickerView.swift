import SwiftUI

struct RolePickerView: View {
    @Environment(AppEnvironment.self) private var environment

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Choose how this device will be used. You can only pick once per sign-in on this phone.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Section {
                    ForEach(UserRole.allCases) { role in
                        Button {
                            environment.session.chooseRole(role)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Label(role.title, systemImage: role == .parent ? "person.2.fill" : "iphone")
                                    .font(.headline)
                                Text(role.subtitle)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 6)
                        }
                    }
                }
            }
            .navigationTitle("This device is…")
        }
    }
}

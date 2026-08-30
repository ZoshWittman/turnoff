import SwiftUI

struct UnlockRequestInbox: View {
    @Environment(AppEnvironment.self) private var environment

    var body: some View {
        ForEach(environment.session.unlockRequests) { request in
            VStack(alignment: .leading, spacing: 8) {
                Text(deviceName(for: request.childDeviceId))
                    .font(.headline)
                Text("Asked to unlock")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                HStack {
                    Button("Approve") {
                        Task { await environment.session.resolve(request: request, approve: true) }
                    }
                    .buttonStyle(.borderedProminent)
                    Button("Deny") {
                        Task { await environment.session.resolve(request: request, approve: false) }
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func deviceName(for id: String) -> String {
        environment.session.devices.first(where: { $0.id == id })?.name ?? "Child device"
    }
}

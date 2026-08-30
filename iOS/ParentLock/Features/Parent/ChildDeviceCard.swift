import ParentLockShared
import SwiftUI

struct ChildDeviceCard: View {
    let device: Device
    @Environment(AppEnvironment.self) private var environment

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(device.name)
                        .font(.headline)
                    Text("Last seen \(device.lastSeenLabel)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                StatusPill(state: device.lockState)
            }
            if let unlockAt = device.unlockAt, device.lockState == .locked {
                Text("Unlocks \(unlockAt.formatted(date: .omitted, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            CommandButtons(device: device)
        }
        .padding(.vertical, 6)
    }
}

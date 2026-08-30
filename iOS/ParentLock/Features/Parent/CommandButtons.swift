import ParentLockShared
import SwiftUI

struct CommandButtons: View {
    let device: Device
    @Environment(AppEnvironment.self) private var environment

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Button("Lock device") {
                    Task { await environment.session.send(command: .lock, to: device) }
                }
                .buttonStyle(.borderedProminent)
                Button("Unlock device") {
                    Task { await environment.session.send(command: .unlock, to: device) }
                }
                .buttonStyle(.bordered)
            }
            Text("Lock for")
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack {
                ForEach([15, 30, 60], id: \.self) { minutes in
                    Button("\(minutes) min") {
                        Task { await environment.session.send(command: .lock, to: device, minutes: minutes) }
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .disabled(environment.session.isBusy)
    }
}

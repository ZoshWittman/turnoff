import ParentLockShared
import SwiftUI

struct StatusPill: View {
    let state: LockState

    var body: some View {
        Label(state == .locked ? "Locked" : "Unlocked", systemImage: state == .locked ? "lock.fill" : "lock.open.fill")
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(state == .locked ? Color.orange.opacity(0.18) : Color.green.opacity(0.18), in: Capsule())
            .foregroundStyle(state == .locked ? Color.orange : Color.green)
            .accessibilityLabel(state == .locked ? "Device locked" : "Device unlocked")
    }
}

struct ErrorBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.footnote)
            .foregroundStyle(.primary)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.orange.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
    }
}

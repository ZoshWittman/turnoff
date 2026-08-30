import Foundation
import ManagedSettings
import ManagedSettingsUI
import UIKit
import ParentLockShared

/// Branded shield shown over blocked apps. Calm copy, no scare tactics.
final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        makeConfiguration()
    }

    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
        makeConfiguration()
    }

    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
        makeConfiguration()
    }

    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
        makeConfiguration()
    }

    private func makeConfiguration() -> ShieldConfiguration {
        let unlockAt = AppGroupStore.shared.unlockAt
        var subtitle = "Your parent paused this iPhone. You can still use allowed apps and the Phone app."
        if let unlockAt {
            let time = unlockAt.formatted(date: .omitted, time: .shortened)
            subtitle = "Your parent paused this iPhone until \(time). You can still use allowed apps and the Phone app."
        }
        return ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterial,
            backgroundColor: UIColor.systemBackground,
            icon: UIImage(systemName: "lock.fill"),
            title: ShieldConfiguration.Label(text: "Locked by parent", color: .label),
            subtitle: ShieldConfiguration.Label(text: subtitle, color: .secondaryLabel),
            primaryButtonLabel: ShieldConfiguration.Label(text: "Ask to unlock", color: .white),
            primaryButtonBackgroundColor: UIColor.systemBlue,
            secondaryButtonLabel: nil
        )
    }
}

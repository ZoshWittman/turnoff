import FirebaseFirestore
import Foundation
import ParentLockShared
import UIKit

/// Owns onboarding progress, family membership, and live device state.
@MainActor
@Observable
final class SessionStore {
    var role: UserRole?
    var familyId: String?
    var deviceId: String?
    var pairing: PairingPayload?
    var family: Family?
    var devices: [Device] = []
    var unlockRequests: [UnlockRequest] = []
    var childDevice: Device?
    var isBusy = false
    var banner: String?

    private let defaults: UserDefaults
    private let appGroup = AppGroupStore.shared
    private var familyListener: ListenerRegistration?
    private var devicesListener: ListenerRegistration?
    private var childListener: ListenerRegistration?
    private var inboxListener: ListenerRegistration?

    private let familyService: FamilyService
    private let deviceService: DeviceService
    private let commandService: CommandService
    private let familyControls: FamilyControlsService
    private let push: PushService
    let applier: CommandApplier

    private let log = ParentLockLog.category("session")

    init(
        familyService: FamilyService,
        deviceService: DeviceService,
        commandService: CommandService,
        familyControls: FamilyControlsService,
        push: PushService,
        defaults: UserDefaults = .standard
    ) {
        self.familyService = familyService
        self.deviceService = deviceService
        self.commandService = commandService
        self.familyControls = familyControls
        self.push = push
        self.defaults = defaults
        self.applier = CommandApplier(commands: commandService)
        if let raw = defaults.string(forKey: "role"), let role = UserRole(rawValue: raw) {
            self.role = role
        }
        familyId = defaults.string(forKey: "familyId") ?? appGroup.familyId
        deviceId = defaults.string(forKey: "deviceId") ?? appGroup.deviceId
    }

    func chooseRole(_ role: UserRole) {
        self.role = role
        defaults.set(role.rawValue, forKey: "role")
    }

    func persistPairing(familyId: String, deviceId: String?) {
        self.familyId = familyId
        self.deviceId = deviceId
        defaults.set(familyId, forKey: "familyId")
        appGroup.familyId = familyId
        if let deviceId {
            defaults.set(deviceId, forKey: "deviceId")
            appGroup.deviceId = deviceId
        }
    }

    func startListening() {
        stopListening()
        guard let familyId else { return }
        familyListener = familyService.listenToFamily(id: familyId) { [weak self] family in
            Task { @MainActor in self?.family = family }
        }
        devicesListener = deviceService.listenToFamilyDevices(familyId: familyId) { [weak self] devices in
            Task { @MainActor in self?.devices = devices }
        }
        inboxListener = commandService.listenToUnlockRequests(familyId: familyId) { [weak self] items in
            Task { @MainActor in self?.unlockRequests = items }
        }
        if role == .child, let deviceId {
            childListener = deviceService.listenToDevice(id: deviceId) { [weak self] device in
                Task { @MainActor in
                    self?.childDevice = device
                    await self?.applier.reconcile(device: device)
                }
            }
        }
    }

    func stopListening() {
        familyListener?.remove()
        devicesListener?.remove()
        childListener?.remove()
        inboxListener?.remove()
        familyListener = nil
        devicesListener = nil
        childListener = nil
        inboxListener = nil
    }

    func createFamilyAndCode() async {
        isBusy = true
        defer { isBusy = false }
        do {
            let payload = try await familyService.createPairingCode(familyId: familyId)
            pairing = payload
            persistPairing(familyId: payload.familyId, deviceId: deviceId)
            startListening()
        } catch {
            banner = error.localizedDescription
        }
    }

    func refreshPairingCode() async {
        await createFamilyAndCode()
    }

    func redeem(code: String) async {
        isBusy = true
        defer { isBusy = false }
        do {
            let name = UIDevice.current.name
            let result = try await familyService.redeemPairingCode(
                code: code,
                deviceName: name,
                pushToken: push.fcmToken
            )
            persistPairing(familyId: result.familyId, deviceId: result.deviceId)
            startListening()
        } catch {
            banner = error.localizedDescription
        }
    }

    func registerParentDeviceIfNeeded() async {
        guard role == .parent, let familyId else { return }
        do {
            let id = try await deviceService.register(
                deviceId: deviceId,
                familyId: familyId,
                role: .parent,
                name: UIDevice.current.name,
                pushToken: push.fcmToken
            )
            persistPairing(familyId: familyId, deviceId: id)
        } catch {
            log.error("Parent device register failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func refreshChildToken() async {
        guard role == .child, let deviceId, let familyId else { return }
        do {
            _ = try await deviceService.register(
                deviceId: deviceId,
                familyId: familyId,
                role: .child,
                name: UIDevice.current.name,
                pushToken: push.fcmToken
            )
        } catch {
            log.error("Child token refresh failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func send(command type: CommandType, to device: Device, minutes: Int? = nil) async {
        isBusy = true
        defer { isBusy = false }
        do {
            let unlockAt = minutes.map { Date().addingTimeInterval(TimeInterval($0 * 60)) }
            let commandType: CommandType = minutes == nil ? type : .lockUntil
            _ = try await commandService.send(deviceId: device.id, type: commandType, unlockAt: unlockAt)
        } catch {
            banner = error.localizedDescription
        }
    }

    func askToUnlock() async {
        guard let deviceId else { return }
        do {
            try await commandService.requestUnlock(childDeviceId: deviceId)
            banner = "Your parent will see this request."
        } catch {
            banner = error.localizedDescription
        }
    }

    func resolve(request: UnlockRequest, approve: Bool) async {
        do {
            try await commandService.resolveUnlockRequest(id: request.id, approve: approve)
        } catch {
            banner = error.localizedDescription
        }
    }

    func unpair(_ device: Device) async {
        do {
            try await deviceService.unpair(deviceId: device.id)
        } catch {
            banner = error.localizedDescription
        }
    }

    func handleIncomingCommand(_ userInfo: [AnyHashable: Any]) async {
        guard let command = PendingCommand(userInfo: userInfo) else { return }
        await applier.apply(command)
    }

    func becomeActive() async {
        familyControls.refreshStatus()
        await push.refreshFcmToken()
        await refreshChildToken()
        await applier.flushPendingUnlockRequest()
        if appGroup.pendingScheduleUnlock {
            shieldClearFromSchedule()
        }
        if let childDevice {
            await applier.reconcile(device: childDevice)
        } else if let pending = appGroup.loadPendingCommand() {
            await applier.apply(pending)
        }
        BackgroundRefreshService.schedule()
    }

    func resetLocalSession() {
        stopListening()
        role = nil
        familyId = nil
        deviceId = nil
        pairing = nil
        family = nil
        devices = []
        unlockRequests = []
        childDevice = nil
        defaults.removeObject(forKey: "role")
        defaults.removeObject(forKey: "familyId")
        defaults.removeObject(forKey: "deviceId")
        appGroup.familyId = nil
        appGroup.deviceId = nil
    }

    var childDevices: [Device] {
        devices.filter(\.isChild)
    }

    private func shieldClearFromSchedule() {
        ShieldService.shared.clearLock()
        appGroup.pendingScheduleUnlock = false
    }
}

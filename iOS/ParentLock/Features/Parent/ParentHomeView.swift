import SwiftUI

struct ParentHomeView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            List {
                if let banner = environment.session.banner {
                    Section { ErrorBanner(message: banner) }
                }

                if !environment.session.unlockRequests.isEmpty {
                    Section("Unlock requests") {
                        UnlockRequestInbox()
                    }
                }

                Section("Your family") {
                    if environment.session.familyId == nil {
                        Button("Create family and pairing code") {
                            Task { await environment.session.createFamilyAndCode() }
                        }
                    } else if environment.session.childDevices.isEmpty {
                        Text("No child devices yet. Share the pairing code below on the child’s iPhone.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(environment.session.childDevices) { device in
                            ChildDeviceCard(device: device)
                        }
                    }
                }

                if let pairing = environment.session.pairing {
                    Section("Pairing code") {
                        PairingCodeView(payload: pairing)
                        Button("New code") {
                            Task { await environment.session.refreshPairingCode() }
                        }
                    }
                } else if environment.session.familyId != nil {
                    Section {
                        Button("Show pairing code") {
                            Task { await environment.session.refreshPairingCode() }
                        }
                    }
                }
            }
            .navigationTitle("ParentLock")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityLabel("Settings")
                }
            }
            .sheet(isPresented: $showSettings) {
                ParentSettingsView()
            }
            .task {
                if environment.session.familyId == nil {
                    await environment.session.createFamilyAndCode()
                } else {
                    environment.session.startListening()
                    await environment.session.registerParentDeviceIfNeeded()
                    if environment.session.pairing == nil {
                        await environment.session.refreshPairingCode()
                    }
                }
                await environment.push.requestAuthorization()
            }
        }
    }
}

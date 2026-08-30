import SwiftUI

struct RedeemCodeView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var code = ""
    @State private var showScanner = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Enter the 6-character code from the parent’s iPhone, or scan their QR.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Section("Pairing code") {
                    TextField("ABC234", text: $code)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .font(.title2.monospaced())
                    Button("Pair this device") {
                        Task { await environment.session.redeem(code: code) }
                    }
                    .disabled(code.trimmingCharacters(in: .whitespacesAndNewlines).count < 6 || environment.session.isBusy)
                    Button("Scan parent QR") {
                        showScanner = true
                    }
                }
                if let banner = environment.session.banner {
                    Section { ErrorBanner(message: banner) }
                }
            }
            .navigationTitle("Connect to a parent")
            .sheet(isPresented: $showScanner) {
                QRScannerView { scanned in
                    showScanner = false
                    if let parsed = Self.code(from: scanned) {
                        code = parsed
                        Task { await environment.session.redeem(code: parsed) }
                    }
                }
            }
        }
    }

    static func code(from payload: String) -> String? {
        if let url = URL(string: payload),
           let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems,
           let code = items.first(where: { $0.name == "code" })?.value {
            return code
        }
        let cleaned = payload.trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.count == 6 ? cleaned : nil
    }
}

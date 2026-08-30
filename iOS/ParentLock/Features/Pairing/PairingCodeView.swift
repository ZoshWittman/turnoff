import SwiftUI

struct PairingCodeView: View {
    let payload: PairingPayload
    @State private var qr: UIImage?

    var body: some View {
        VStack(spacing: 20) {
            Text(payload.code)
                .font(.system(size: 40, weight: .semibold, design: .rounded))
                .tracking(6)
                .accessibilityAddTraits(.isHeader)
            if let qr {
                Image(uiImage: qr)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 200, height: 200)
                    .padding()
                    .background(.background, in: RoundedRectangle(cornerRadius: 16))
                    .accessibilityLabel("Pairing QR code")
            }
            Text("Ask your child to enter this code or scan the QR in ParentLock. It expires in 24 hours.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .onAppear {
            qr = QRCodeService.image(from: payload.qrPayload)
        }
    }
}

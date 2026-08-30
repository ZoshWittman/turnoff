import CoreImage.CIFilterBuiltins
import UIKit

/// Renders the pairing deep link as a QR code image.
enum QRCodeService {
    /// Returns a QR UIImage for `parentlock://pair?code=…`, or nil if encoding fails.
    static func image(from payload: String, scale: CGFloat = 10) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(payload.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let context = CIContext()
        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

/**
 * Ruta de lectura dedicada a QR.
 * Usa ZXing configurado exclusivamente con el formato QR_CODE sobre los mismos
 * frames del video: no abre una segunda cámara ni un segundo stream.
 */

export type QrDecoder = {
  decode: (canvas: HTMLCanvasElement) => string | null;
  reset: () => void;
};

export async function createQrDecoder(): Promise<QrDecoder | null> {
  try {
    const zxing = await import("@zxing/library");
    const {
      MultiFormatReader,
      BarcodeFormat,
      DecodeHintType,
      RGBLuminanceSource,
      HybridBinarizer,
      BinaryBitmap,
    } = zxing;

    const reader = new MultiFormatReader();
    const hints = new Map<number, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints as never);

    return {
      decode(canvas) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx || !canvas.width || !canvas.height) return null;
        let data: ImageData;
        try {
          data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch {
          return null;
        }
        const pixels = new Int32Array(canvas.width * canvas.height);
        const raw = data.data;
        for (let i = 0, j = 0; i < raw.length; i += 4, j += 1) {
          pixels[j] = (0xff << 24) | (raw[i]! << 16) | (raw[i + 1]! << 8) | raw[i + 2]!;
        }
        try {
          const source = new RGBLuminanceSource(pixels, canvas.width, canvas.height);
          const bitmap = new BinaryBitmap(new HybridBinarizer(source));
          const result = reader.decode(bitmap);
          return result?.getText() ?? null;
        } catch {
          return null; // sin QR en este frame
        } finally {
          reader.reset();
        }
      },
      reset() {
        try {
          reader.reset();
        } catch {
          /* ignorado */
        }
      },
    };
  } catch {
    return null;
  }
}

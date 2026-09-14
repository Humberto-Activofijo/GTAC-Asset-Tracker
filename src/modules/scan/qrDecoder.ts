/**
 * Rutas de lectura dedicadas a QR sobre los mismos frames del video:
 *  - Ruta 1: ZXing configurado exclusivamente con el formato QR_CODE.
 *  - Ruta 2: jsQR (especializado en QR desde ImageData) para etiquetas impresas
 *    con perspectiva ligera, reflejos, ruido o bordes poco nítidos.
 * Ninguna de las dos abre una segunda cámara ni modifica la imagen mostrada.
 */

type JsQrFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" },
) => { data: string } | null;

export type QrDecoder = {
  /** Ruta 1: ZXing QR. */
  decodeZxing: (canvas: HTMLCanvasElement) => string | null;
  /** Ruta 2: jsQR, con intento adicional sobre una versión de contraste mejorado. */
  decodeFallback: (canvas: HTMLCanvasElement) => string | null;
  fallbackReady: boolean;
  reset: () => void;
};

function imageDataOf(canvas: HTMLCanvasElement): ImageData | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !canvas.width || !canvas.height) return null;
  try {
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
}

/** Copia en escala de grises con estiramiento de contraste; no altera el canvas original. */
function enhancedCopy(source: ImageData): ImageData {
  const src = source.data;
  const gray = new Uint8ClampedArray(src.length / 4);
  let min = 255;
  let max = 0;
  for (let i = 0, j = 0; i < src.length; i += 4, j += 1) {
    const g = (src[i]! * 0.299 + src[i + 1]! * 0.587 + src[i + 2]! * 0.114) | 0;
    gray[j] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const span = Math.max(1, max - min);
  const out = new Uint8ClampedArray(src.length);
  for (let j = 0, i = 0; j < gray.length; j += 1, i += 4) {
    const v = ((gray[j]! - min) * 255) / span;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }
  return new ImageData(out, source.width, source.height);
}

export async function createQrDecoder(): Promise<QrDecoder | null> {
  let jsQR: JsQrFn | null = null;
  try {
    const mod = await import("jsqr");
    jsQR = (mod.default ?? (mod as unknown as JsQrFn)) as JsQrFn;
  } catch {
    jsQR = null;
  }

  let zxingDecode: ((canvas: HTMLCanvasElement) => string | null) | null = null;
  let zxingReset: (() => void) | null = null;
  try {
    const {
      MultiFormatReader,
      BarcodeFormat,
      DecodeHintType,
      RGBLuminanceSource,
      HybridBinarizer,
      BinaryBitmap,
    } = await import("@zxing/library");

    const reader = new MultiFormatReader();
    const hints = new Map<number, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints as never);

    zxingReset = () => reader.reset();
    zxingDecode = (canvas) => {
      const data = imageDataOf(canvas);
      if (!data) return null;
      const pixels = new Int32Array(canvas.width * canvas.height);
      const raw = data.data;
      for (let i = 0, j = 0; i < raw.length; i += 4, j += 1) {
        pixels[j] = (0xff << 24) | (raw[i]! << 16) | (raw[i + 1]! << 8) | raw[i + 2]!;
      }
      try {
        const source = new RGBLuminanceSource(pixels, canvas.width, canvas.height);
        const bitmap = new BinaryBitmap(new HybridBinarizer(source));
        return reader.decode(bitmap)?.getText() ?? null;
      } catch {
        return null; // sin QR en este frame
      } finally {
        reader.reset();
      }
    };
  } catch {
    zxingDecode = null;
  }

  if (!zxingDecode && !jsQR) return null;

  return {
    fallbackReady: jsQR !== null,
    decodeZxing: (canvas) => (zxingDecode ? zxingDecode(canvas) : null),
    decodeFallback: (canvas) => {
      if (!jsQR) return null;
      const data = imageDataOf(canvas);
      if (!data) return null;
      try {
        const direct = jsQR(data.data, data.width, data.height, {
          inversionAttempts: "attemptBoth",
        });
        if (direct?.data) return direct.data;
        const boosted = enhancedCopy(data);
        const second = jsQR(boosted.data, boosted.width, boosted.height, {
          inversionAttempts: "attemptBoth",
        });
        return second?.data ?? null;
      } catch {
        return null;
      }
    },
    reset() {
      try {
        zxingReset?.();
      } catch {
        /* ignorado */
      }
    },
  };
}

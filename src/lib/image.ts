/** Compresión de fotografías en el cliente antes de subirlas al almacenamiento. */

export const MAX_IMAGE_DIMENSION = 1600;
export const TARGET_IMAGE_BYTES = 300 * 1024;

const QUALITIES = [0.82, 0.72, 0.62, 0.52];

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return await createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No fue posible leer la imagen."));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Reduce el lado mayor a 1600 px y ajusta la calidad JPEG buscando ~300 KB,
 * sin degradar la imagen al punto de volver ilegibles etiquetas o códigos.
 * Si algo falla, se devuelve el archivo original.
 */
export async function compressImage(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  try {
    const source = await loadBitmap(file);
    const width = "width" in source ? source.width : 0;
    const height = "height" in source ? source.height : 0;
    if (!width || !height) return file;

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(source as CanvasImageSource, 0, 0, targetW, targetH);
    if ("close" in source && typeof source.close === "function") source.close();

    let best: Blob | null = null;
    for (const quality of QUALITIES) {
      const blob = await toBlob(canvas, "image/jpeg", quality);
      if (!blob) continue;
      best = blob;
      if (blob.size <= TARGET_IMAGE_BYTES) break;
    }
    if (!best || best.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([best], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

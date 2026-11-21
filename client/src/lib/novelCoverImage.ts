export const MAX_NOVEL_COVER_INPUT_BYTES = 24 * 1024 * 1024;
export const MAX_NOVEL_COVER_OUTPUT_BYTES = 2 * 1024 * 1024;
export const NOVEL_COVER_MAX_EDGE = 1800;

export type PreparedNovelCover = {
  blob: Blob;
  mimeType: "image/webp" | "image/jpeg";
  dataBase64: string;
  width: number;
  height: number;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

const acceptedInputTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function imageFromElement(file: File): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected image could not be opened."));
    };
    image.src = objectUrl;
  });
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Use the standard HTML image decoder on browsers that cannot decode this image type.
    }
  }
  return imageFromElement(file);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  const firstWebp = await canvasToBlob(canvas, "image/webp", 0.82);
  if (firstWebp?.type === "image/webp") {
    let best = firstWebp;
    if (best.size <= MAX_NOVEL_COVER_OUTPUT_BYTES) return best;
    for (const quality of [0.74, 0.66, 0.58]) {
      const candidate = await canvasToBlob(canvas, "image/webp", quality);
      if (candidate?.type === "image/webp" && candidate.size < best.size) best = candidate;
      if (candidate?.type === "image/webp" && candidate.size <= MAX_NOVEL_COVER_OUTPUT_BYTES) return candidate;
    }
    return best;
  }

  const jpegCanvas = document.createElement("canvas");
  jpegCanvas.width = canvas.width;
  jpegCanvas.height = canvas.height;
  const context = jpegCanvas.getContext("2d");
  if (!context) throw new Error("This browser cannot process the selected image.");
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
  context.drawImage(canvas, 0, 0);
  let best: Blob | null = null;
  for (const quality of [0.84, 0.76, 0.68, 0.60]) {
    const candidate = await canvasToBlob(jpegCanvas, "image/jpeg", quality);
    if (candidate?.type === "image/jpeg" && (!best || candidate.size < best.size)) best = candidate;
    if (candidate?.type === "image/jpeg" && candidate.size <= MAX_NOVEL_COVER_OUTPUT_BYTES) return candidate;
  }
  if (best) return best;
  throw new Error("This browser could not compress the selected image.");
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      const separator = value.indexOf(",");
      if (separator < 0) reject(new Error("The compressed image could not be prepared."));
      else resolve(value.slice(separator + 1));
    };
    reader.onerror = () => reject(new Error("The compressed image could not be prepared."));
    reader.readAsDataURL(blob);
  });
}

export async function prepareNovelCover(file: File): Promise<PreparedNovelCover> {
  if (!acceptedInputTypes.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image file.");
  }
  if (!file.size || file.size > MAX_NOVEL_COVER_INPUT_BYTES) {
    throw new Error("Choose an image smaller than 24 MiB.");
  }

  const decoded = await decodeImage(file);
  try {
    if (!decoded.width || !decoded.height || decoded.width * decoded.height > 60_000_000) {
      throw new Error("This image has too many pixels to process on this device.");
    }
    let scale = Math.min(1, NOVEL_COVER_MAX_EDGE / Math.max(decoded.width, decoded.height));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot process the selected image.");
      context.drawImage(decoded.source, 0, 0, width, height);
      const blob = await encodeCanvas(canvas);
      if (blob.size <= MAX_NOVEL_COVER_OUTPUT_BYTES && (blob.type === "image/webp" || blob.type === "image/jpeg")) {
        return {
          blob,
          mimeType: blob.type,
          dataBase64: await blobToBase64(blob),
          width,
          height,
        };
      }
      scale *= 0.78;
    }
    throw new Error("This image is still too large after compression. Choose a smaller image.");
  } finally {
    decoded.dispose();
  }
}

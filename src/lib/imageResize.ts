// src/lib/imageResize.ts
// Ridimensiona e ricomprime un'immagine prima di salvarla in IndexedDB.
// Le foto del telefono pesano 5-10MB: le portiamo a ~max 1600px / WebP.

const MAX_DIM = 1600;
const QUALITY = 0.82;

export async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createBitmap(file);

  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width  * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponibile');
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  // Preferisce WebP; fallback automatico a JPEG se non supportato.
  const blob = await toBlob(canvas, 'image/webp', QUALITY)
    ?? await toBlob(canvas, 'image/jpeg', QUALITY);
  if (!blob) throw new Error('Conversione immagine fallita');
  return blob;
}

function createBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file);
  }
  // Fallback per browser senza createImageBitmap
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, q));
}

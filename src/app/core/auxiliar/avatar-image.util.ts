/** Max edge length for profile avatars after optimization. */
export const AVATAR_MAX_EDGE_PX = 256;

/** WebP quality (0–1) for avatar compression. */
export const AVATAR_WEBP_QUALITY = 0.82;

export const AVATAR_STORAGE_BUCKET = 'avatars';

export const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export const AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024;

/**
 * Resizes and converts an image to WebP using an off-screen canvas.
 * Falls back to JPEG if WebP encoding is unavailable.
 */
export async function optimizeImageForAvatar(file: File): Promise<Blob> {
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    throw new Error('Image must be smaller than 5 MB.');
  }

  if (!AVATAR_ALLOWED_TYPES.includes(file.type as (typeof AVATAR_ALLOWED_TYPES)[number])) {
    throw new Error('Use JPG, PNG, WebP or GIF.');
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Could not process image.');
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const webp = await canvasToBlob(canvas, 'image/webp', AVATAR_WEBP_QUALITY);
  if (webp) return webp;

  const jpeg = await canvasToBlob(canvas, 'image/jpeg', AVATAR_WEBP_QUALITY);
  if (jpeg) return jpeg;

  throw new Error('Could not compress image.');
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

/** Builds initials from a display name (max 2 chars). */
export function buildUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

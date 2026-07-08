// Mirrors the backend allow-list in ImageProcessingService.ALLOWED_CONTENT_TYPES.
// Non-JPEG/PNG uploads are rejected server-side, so we validate at pick time to give
// immediate feedback instead of a failed round-trip that surfaces as a raw error.
export const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
export const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png'];
export const SUPPORTED_IMAGE_LABEL = 'JPEG or PNG';

// Other image formats the OS/browser picker can return under `image/*` but the
// backend won't accept. Used to reject a known-bad type while deferring anything
// we can't classify to the server.
const KNOWN_IMAGE_EXTENSIONS = [
  ...SUPPORTED_IMAGE_EXTENSIONS,
  'gif', 'webp', 'heic', 'heif', 'bmp', 'tif', 'tiff', 'svg', 'avif',
];

interface PickedAsset {
  mimeType?: string | null;
  fileName?: string | null;
  uri?: string;
}

/**
 * True when the picked asset is a JPEG/PNG. Prefers the reported mimeType and falls
 * back to the file/uri extension. When the type genuinely can't be determined
 * locally, returns true and lets the backend remain the authority.
 */
export function isSupportedImage(asset: PickedAsset): boolean {
  const mime = asset.mimeType?.toLowerCase();
  if (mime && mime.startsWith('image/')) {
    return SUPPORTED_IMAGE_MIME_TYPES.includes(mime);
  }

  const name = (asset.fileName ?? asset.uri ?? '').toLowerCase().split('?')[0];
  const ext = name.includes('.') ? name.split('.').pop()! : '';
  if (ext && KNOWN_IMAGE_EXTENSIONS.includes(ext)) {
    return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
  }

  return true;
}

export const UNSUPPORTED_IMAGE_MESSAGE = `Unsupported image type. Please choose a ${SUPPORTED_IMAGE_LABEL} file.`;

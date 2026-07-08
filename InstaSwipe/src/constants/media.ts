// Mirrors the backend upload constraints so we can validate a picked image before
// submitting it, giving immediate feedback instead of a failed round-trip that
// surfaces as a raw error.
//   - Types: ImageProcessingService.ALLOWED_CONTENT_TYPES
//   - Size:  media.max-image-size (also enforced at the multipart layer in MediaConfig)
export const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
export const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png'];
export const SUPPORTED_IMAGE_LABEL = 'JPEG or PNG';

// Spring's DataSize parses "10MB" as 10 * 1024 * 1024 bytes.
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_SIZE_LABEL = '10 MB';

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
  fileSize?: number | null;
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

/**
 * True when the asset is within the backend size cap. When the picker doesn't
 * report a size, returns true and lets the backend enforce the limit.
 */
export function isWithinImageSizeLimit(asset: PickedAsset): boolean {
  return typeof asset.fileSize === 'number' ? asset.fileSize <= MAX_IMAGE_SIZE_BYTES : true;
}

export const UNSUPPORTED_IMAGE_MESSAGE = `Unsupported image type. Please choose a ${SUPPORTED_IMAGE_LABEL} file.`;
export const IMAGE_TOO_LARGE_MESSAGE = `Image is too large. Please choose a file under ${MAX_IMAGE_SIZE_LABEL}.`;

/** Returns the first validation error for a picked image, or null when it passes. */
export function getImageValidationError(asset: PickedAsset): string | null {
  if (!isSupportedImage(asset)) {
    return UNSUPPORTED_IMAGE_MESSAGE;
  }
  if (!isWithinImageSizeLimit(asset)) {
    return IMAGE_TOO_LARGE_MESSAGE;
  }
  return null;
}

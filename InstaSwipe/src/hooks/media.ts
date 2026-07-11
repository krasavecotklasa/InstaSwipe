import { API_HOST } from '@/hooks/api';

const MEDIA_PORT = 9000;

export const getMediaOrigin = () => {
  const override = process.env.EXPO_PUBLIC_MEDIA_ORIGIN;
  if (override) {
    return override;
  }

  if (!API_HOST) {
    return undefined;
  }

  return `http://${API_HOST}:${MEDIA_PORT}`;
};

export const normalizeMediaUrl = (url: string | null | undefined) => {
  if (!url || !API_HOST) {
    return url ?? null;
  }

  try {
    const parsed = new URL(url);
    const shouldRewrite =
      parsed.port === String(MEDIA_PORT) ||
      parsed.hostname === 'minio' ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === 'host.docker.internal' ||
      parsed.hostname.endsWith('.docker.internal');

    if (!shouldRewrite) {
      return url;
    }

    return `${getMediaOrigin()}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
};

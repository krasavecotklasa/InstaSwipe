import { useCallback, useEffect, useRef, useState } from 'react';

import { API_PREFIX } from '@/hooks/api';
import { authorizedFetch } from '@/hooks/auth';

const GIFS_BASE_PATH = `${API_PREFIX}/gifs`;

const GIPHY_MEDIA_HOST_PATTERN = /^(?:media\d*|i)\.giphy\.com$/;

const getGiphyGifUrl = (url: URL) => {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const pathParts = url.pathname.split('/').filter(Boolean);

  if (GIPHY_MEDIA_HOST_PATTERN.test(host) && /\.gif$/i.test(url.pathname)) {
    return url.toString();
  }

  if (host !== 'giphy.com') {
    return null;
  }

  const mediaIndex = pathParts.indexOf('media');
  if (mediaIndex >= 0 && pathParts[mediaIndex + 1]) {
    return `https://media.giphy.com/media/${pathParts[mediaIndex + 1]}/giphy.gif`;
  }

  const viewIndex = pathParts.findIndex((part) => part === 'gifs' || part === 'embed');
  const viewSlug = viewIndex >= 0 ? pathParts[viewIndex + 1] : undefined;
  const id = viewSlug?.split('-').pop();

  return id ? `https://media.giphy.com/media/${id}/giphy.gif` : null;
};

const getKlipyGifUrl = (url: URL): string | null => {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  // Direct .gif on Klipy's static CDN — already a media URL
  if ((host === 'static.klipy.com' || host === 'static2.klipy.com') && /\.gif$/i.test(url.pathname)) {
    return url.toString();
  }

  return null;
};

const getKlipyMediaUrl = async (value: string): Promise<string | null> => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'klipy.com') return null;

    const res = await fetch(value);
    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+\.gif[^"']*)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+\.gif[^"']*)["'][^>]+property=["']og:image["']/i);

    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

const getKlipyPostId = (value: string): string | null => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'klipy.com') return null;

    const pathParts = url.pathname.split('/').filter(Boolean);
    // /gifs/<slug>
    return pathParts[0] === 'gifs' && pathParts[1] ? pathParts[1] : null;
  } catch {
    return null;
  }
};

type MessageGif = {
  url: string;
  provider: string;
};

export type GifProvider = 'all' | 'giphy' | 'klipy';

export type GifSearchItem = {
  id: string;
  provider: string;
  title: string;
  gifUrl: string;
  previewUrl: string;
  sourceUrl: string;
  width: number | null;
  height: number | null;
};

type GifSearchResponse = {
  content?: GifSearchItem[];
  nextOffset?: string | null;
};

type GifSearchResult = {
  items: GifSearchItem[];
  nextOffset: string | null;
};

export const searchGifs = async (
  query: string,
  provider: GifProvider = 'all',
  limit = 24,
  offset = '0',
): Promise<GifSearchResult> => {
  const text = query.trim();
  if (!text) {
    return { items: [], nextOffset: null };
  }

  const params = new URLSearchParams({
    q: text,
    provider,
    limit: String(limit),
    offset: String(offset),
  });

  const response = await authorizedFetch(`${GIFS_BASE_PATH}/search?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: '*/*' },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Could not search GIFs (status ${response.status})`);
  }

  const data = (await response.json()) as GifSearchResponse;
  const items = Array.isArray(data.content) ? data.content : [];
  return {
    items,
    nextOffset: data.nextOffset && data.nextOffset !== '' ? data.nextOffset : null,
  };
};

export const useGifSearch = (query: string, provider: GifProvider, enabled: boolean) => {
  const [results, setResults] = useState<GifSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextOffset, setNextOffset] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (!enabled || !text) {
      setResults([]);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      setNextOffset(null);
      setHasMore(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setNextOffset(null);
    setHasMore(false);

    const timer = setTimeout(() => {
      searchGifs(text, provider, 24, '0')
        .then(({ items, nextOffset: next }) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setResults(items);
          setNextOffset(next);
          setHasMore(Boolean(next && items.length > 0));
        })
        .catch((searchError) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setResults([]);
          setNextOffset(null);
          setHasMore(false);
          setError(searchError instanceof Error ? searchError.message : 'Could not search GIFs');
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [enabled, provider, query]);

  const loadMore = useCallback(async () => {
    const text = query.trim();
    if (!enabled || !text || loading || loadingMore || !nextOffset || !hasMore) {
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoadingMore(true);
    setError(null);

    try {
      const { items: nextItems, nextOffset: newOffset } = await searchGifs(text, provider, 24, nextOffset);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setResults((current) => [...current, ...nextItems]);
      setNextOffset(newOffset);
      setHasMore(Boolean(newOffset && nextItems.length > 0));
    } catch (searchError) {
      if (requestId === requestIdRef.current) {
        setError(searchError instanceof Error ? searchError.message : 'Could not load more GIFs');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [enabled, hasMore, loading, loadingMore, nextOffset, provider, query]);

  return { results, loading, loadingMore, error, loadMore, hasMore };
};

const getDirectMessageGif = (content: string): MessageGif | null => {
  const value = content.trim();

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const isTenorMedia = host === 'media.tenor.com' || host === 'media1.tenor.com' || host === 'c.tenor.com';
    const isGifFile = /\.gif$/i.test(url.pathname);
    const giphyGifUrl = getGiphyGifUrl(url);
    const isKlipyMedia = (host === 'static.klipy.com' || host === 'static2.klipy.com');
    const klipyGifUrl = getKlipyGifUrl(url);

    if (isKlipyMedia && isGifFile) return { url: value, provider: 'Klipy' };

    if (giphyGifUrl) {
      return { url: giphyGifUrl, provider: 'GIPHY' };
    }

    if (isTenorMedia && isGifFile) {
      return { url: value, provider: 'Tenor' };
    }

    if (klipyGifUrl) {
      return { url: klipyGifUrl, provider: 'Klipy' };
    }

    return null;
  } catch {
    return null;
  }
};

export const useMessageGif = (content: string): MessageGif | null => {
  const directGif = getDirectMessageGif(content);
  const [resolvedKlipy, setResolvedKlipy] = useState<{ value: string; url: string | null } | null>(null);

  const value = content.trim();
  const klipyPostId = directGif ? null : getKlipyPostId(value);

  useEffect(() => {
    if (!klipyPostId) return;
    let active = true;
    getKlipyMediaUrl(value).then((url) => {
      if (active) setResolvedKlipy({ value, url });
    });
    return () => { active = false; };
  }, [klipyPostId, value]);

  if (directGif) return directGif;

  if (resolvedKlipy?.value === value && resolvedKlipy.url) {
    return { url: resolvedKlipy.url, provider: 'Klipy' };
  }

  return null;
};

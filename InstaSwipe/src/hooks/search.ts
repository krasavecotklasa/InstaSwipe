import { API_PREFIX } from '@/hooks/api';
import { authorizedFetch } from '@/hooks/auth';
import type { DiscoveryProfile, PageResponse } from '@/hooks/matches';
import { normalizeMediaUrl } from '@/hooks/media';

const SEARCH_BASE_PATH = `${API_PREFIX}/search`;

export interface ProfileSearchParams {
  q: string;
  page?: number;
  size?: number;
}

/**
 * Plain people-search by display name. Backed by /api/search/profiles, which
 * (unlike discovery) does not hide already liked/passed users. Returns the same
 * profile shape as discovery so the results list can render both.
 */
export const searchProfilesByName = async (
  params: ProfileSearchParams,
): Promise<PageResponse<DiscoveryProfile>> => {
  const query = new URLSearchParams();
  query.append('q', params.q.trim());
  query.append('page', String(params.page ?? 0));
  query.append('size', String(params.size ?? 20));

  const response = await authorizedFetch(`${SEARCH_BASE_PATH}/profiles?${query.toString()}`, {
    method: 'GET',
    headers: { Accept: '*/*' },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Search request failed with status ${response.status}`);
  }

  const data = await response.json();

  return {
    ...data,
    content: Array.isArray(data?.content)
      ? data.content.map((profile: DiscoveryProfile) => ({
          ...profile,
          profilePictureUrl: normalizeMediaUrl(profile.profilePictureUrl),
        }))
      : [],
  };
};

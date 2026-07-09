import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { API_PREFIX } from '@/hooks/api';
import { authorizedFetch } from '@/hooks/auth';
import { normalizeMediaUrl } from '@/hooks/media';

const DISCOVERY_BASE_PATH = `${API_PREFIX}/discovery`;
const MATCHES_BASE_PATH = `${API_PREFIX}/matches`;

const PAGE_SIZE = 20;
// Prefetch the next page once the in-memory stack drops to this many cards so the
// user never hits an empty "No profiles found" state while more results exist.
const PREFETCH_THRESHOLD = 5;

export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER';

export const DISCOVERY_GENDERS: Gender[] = ['FEMALE', 'MALE', 'NON_BINARY', 'OTHER'];
export const DISCOVERY_GENDER_LABELS: Record<Gender, string> = {
  FEMALE: 'Female',
  MALE: 'Male',
  NON_BINARY: 'Non-Binary',
  OTHER: 'Other',
};

export interface DiscoveryProfile {
  id: string;
  displayName: string;
  bio: string;
  age: number;
  country: string;
  gender: Gender;
  interests: string[];
  profilePictureUrl: string | null;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface DiscoveryFilters {
  minAge?: number;
  maxAge?: number;
  gender?: string;
  country?: string;
  interests?: string[];
  page?: number;
  size?: number;
  sort?: string[];
}

export interface DiscoveryPreferences {
  minAge: number | '';
  maxAge: number | '';
  gender: Gender | '';
  country: string;
  interests: string[];
}

export type SwipeStatus = 'PASSED' | 'LIKED' | 'MATCHED';

export interface SwipeResult {
  status: SwipeStatus;
  matchId: string | null;
}

const DISCOVERY_PREFERENCES_KEY = 'discovery_preferences';

const isWebPlatform = () => Platform.OS === 'web';

const appendNumberParam = (params: URLSearchParams, key: string, value?: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    params.append(key, String(value));
  }
};

const appendStringParam = (params: URLSearchParams, key: string, value?: string) => {
  const normalized = value?.trim();
  if (normalized) {
    params.append(key, normalized);
  }
};

const normalizeDiscoveryGender = (value?: string) => {
  const normalized = value?.trim().toUpperCase();
  return normalized && DISCOVERY_GENDERS.includes(normalized as Gender) ? normalized : undefined;
};

const buildDiscoveryQuery = (filters: DiscoveryFilters = {}) => {
  const params = new URLSearchParams();

  appendNumberParam(params, 'minAge', filters.minAge);
  appendNumberParam(params, 'maxAge', filters.maxAge);
  appendStringParam(params, 'gender', normalizeDiscoveryGender(filters.gender));
  appendStringParam(params, 'country', filters.country);
  appendNumberParam(params, 'page', filters.page ?? 0);
  appendNumberParam(params, 'size', filters.size ?? PAGE_SIZE);

  filters.interests
    ?.map((interest) => interest.trim())
    .filter(Boolean)
    .forEach((interest) => params.append('interests', interest));

  filters.sort
    ?.map((sort) => sort.trim())
    .filter(Boolean)
    .forEach((sort) => params.append('sort', sort));

  const query = params.toString();
  return query ? `?${query}` : '';
};

const normalizeDiscoveryPreferences = (preferences: Partial<DiscoveryPreferences> | null | undefined): DiscoveryPreferences => {
  return {
    minAge: typeof preferences?.minAge === 'number' && Number.isFinite(preferences.minAge) ? preferences.minAge : '',
    maxAge: typeof preferences?.maxAge === 'number' && Number.isFinite(preferences.maxAge) ? preferences.maxAge : '',
    gender: preferences?.gender && DISCOVERY_GENDERS.includes(preferences.gender as Gender)
      ? (preferences.gender as Gender)
      : '',
    country: preferences?.country?.trim() || '',
    interests: Array.isArray(preferences?.interests)
      ? preferences.interests.map((interest) => interest.trim()).filter(Boolean)
      : [],
  };
};

export const getDiscoveryPreferences = async (): Promise<DiscoveryPreferences> => {
  // Never reject: a storage read/parse failure must fall back to defaults rather
  // than propagate and break callers that batch this with other requests.
  try {
    const rawValue = isWebPlatform()
      ? window.localStorage.getItem(DISCOVERY_PREFERENCES_KEY)
      : await SecureStore.getItemAsync(DISCOVERY_PREFERENCES_KEY);

    if (!rawValue) {
      return normalizeDiscoveryPreferences(null);
    }

    return normalizeDiscoveryPreferences(JSON.parse(rawValue));
  } catch {
    return normalizeDiscoveryPreferences(null);
  }
};

const normalizeDiscoveryProfile = (profile: DiscoveryProfile): DiscoveryProfile => ({
  ...profile,
  profilePictureUrl: normalizeMediaUrl(profile.profilePictureUrl),
});

export const setDiscoveryPreferences = async (preferences: Partial<DiscoveryPreferences>) => {
  const normalized = normalizeDiscoveryPreferences(preferences);
  const serialized = JSON.stringify(normalized);

  if (isWebPlatform()) {
    window.localStorage.setItem(DISCOVERY_PREFERENCES_KEY, serialized);
  } else {
    await SecureStore.setItemAsync(DISCOVERY_PREFERENCES_KEY, serialized);
  }

  return normalized;
};

export class MatchAPI {
  static async getDiscovery(filters: DiscoveryFilters = {}): Promise<PageResponse<DiscoveryProfile>> {
    const response = await authorizedFetch(`${DISCOVERY_BASE_PATH}${buildDiscoveryQuery(filters)}`, {
      method: 'GET',
      headers: { Accept: '*/*' },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Discovery request failed with status ${response.status}`);
    }

    const data = await response.json();

    return {
      ...data,
      content: Array.isArray(data?.content) ? data.content.map(normalizeDiscoveryProfile) : [],
    };
  }

  private static async swipe(userId: string, action: 'love' | 'pass'): Promise<SwipeResult> {
    const response = await authorizedFetch(`${MATCHES_BASE_PATH}/${userId}/${action}`, {
      method: 'POST',
      headers: { Accept: '*/*' },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Match request failed with status ${response.status}`);
    }

    return await response.json();
  }

  static async lovePerson(userId: string): Promise<SwipeResult> {
    return MatchAPI.swipe(userId, 'love');
  }

  static async passPerson(userId: string): Promise<SwipeResult> {
    return MatchAPI.swipe(userId, 'pass');
  }
}

export const getDiscovery = MatchAPI.getDiscovery;
export const lovePerson = MatchAPI.lovePerson;
export const passPerson = MatchAPI.passPerson;

const toDiscoveryFilters = (preferences: DiscoveryPreferences, page: number): DiscoveryFilters => ({
  minAge: preferences.minAge === '' ? undefined : preferences.minAge,
  maxAge: preferences.maxAge === '' ? undefined : preferences.maxAge,
  gender: preferences.gender || undefined,
  country: preferences.country,
  interests: preferences.interests,
  page,
  size: PAGE_SIZE,
});

export const formatResultMessage = (result: SwipeResult) => {
  if (result.status === 'MATCHED') {
    return "It's a match!";
  }

  if (result.status === 'LIKED') {
    return 'Liked';
  }

  return 'Passed';
};

/**
 * Shared discovery + swipe controller for the native and web match screens. Owns
 * fetching, pagination, and the single-decision lock so both platforms behave
 * identically and can't fire two swipes for the same card.
 */
export function useDiscoverySwipe() {
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const profilesRef = useRef<DiscoveryProfile[]>([]);
  const pageRef = useRef(0);
  const hasMoreRef = useRef(false);
  const actingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResultMessage(null);
    pageRef.current = 0;
    hasMoreRef.current = false;

    try {
      const preferences = await getDiscoveryPreferences();
      const result = await getDiscovery(toDiscoveryFilters(preferences, 0));
      setProfiles(result.content);
      hasMoreRef.current = !result.last;
    } catch (loadError) {
      setProfiles([]);
      setError(loadError instanceof Error ? loadError.message : 'Could not load matches');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) {
      return;
    }
    loadingMoreRef.current = true;

    try {
      const nextPage = pageRef.current + 1;
      const preferences = await getDiscoveryPreferences();
      const result = await getDiscovery(toDiscoveryFilters(preferences, nextPage));
      pageRef.current = nextPage;
      hasMoreRef.current = !result.last;
      setProfiles((current) => [...current, ...result.content]);
    } catch {
      // Keep the current stack; the next decision will retry paging.
    } finally {
      loadingMoreRef.current = false;
    }
  }, []);

  // Acquire the single-decision lock synchronously so a fast double-tap or a
  // second swipe started during the card animation can't run a second decision.
  const beginDecision = useCallback(() => {
    if (actingRef.current || profilesRef.current.length === 0) {
      return false;
    }
    actingRef.current = true;
    setActing(true);
    return true;
  }, []);

  const cancelDecision = useCallback(() => {
    actingRef.current = false;
    setActing(false);
  }, []);

  // Commit the decision for the current top card. Assumes beginDecision() already
  // acquired the lock. Returns true when the swipe was recorded on the server.
  const finishDecision = useCallback(async (action: 'love' | 'pass') => {
    const currentProfile = profilesRef.current[0];
    if (!currentProfile) {
      cancelDecision();
      return false;
    }

    setError(null);
    setResultMessage(null);

    try {
      const result = action === 'love'
        ? await lovePerson(currentProfile.id)
        : await passPerson(currentProfile.id);

      setResultMessage(formatResultMessage(result));
      setProfiles((current) => current.slice(1));

      // profilesRef still holds the pre-slice stack here, so `length - 1` is the
      // count that will remain after this decision.
      if (profilesRef.current.length - 1 <= PREFETCH_THRESHOLD) {
        void loadMore();
      }

      return true;
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Could not save your choice');
      return false;
    } finally {
      actingRef.current = false;
      setActing(false);
    }
  }, [cancelDecision, loadMore]);

  // Lock + commit in one call, for button taps and the web screen.
  const handleDecision = useCallback(async (action: 'love' | 'pass') => {
    if (!beginDecision()) {
      return false;
    }
    return finishDecision(action);
  }, [beginDecision, finishDecision]);

  useFocusEffect(
    useCallback(() => {
      void loadProfiles();
    }, [loadProfiles]),
  );

  return {
    profiles,
    currentProfile: profiles[0] as DiscoveryProfile | undefined,
    loading,
    acting,
    error,
    resultMessage,
    loadProfiles,
    loadMore,
    beginDecision,
    cancelDecision,
    finishDecision,
    handleDecision,
  };
}

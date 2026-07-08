import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { normalizeMediaUrl } from '@/hooks/media';

const API_HOST = process.env.EXPO_PUBLIC_API_HOST;
const API_PORT = process.env.EXPO_PUBLIC_API_PORT;
const API_PREFIX_RAW = process.env.EXPO_PUBLIC_API_PREFIX || '/api';
const API_PREFIX = API_PREFIX_RAW.startsWith('/') ? API_PREFIX_RAW : `/${API_PREFIX_RAW}`;
const DISCOVERY_BASE_PATH = `${API_PREFIX}/discovery`;
const MATCHES_BASE_PATH = `${API_PREFIX}/matches`;
const API_BASE_URL = (API_PORT === '80' || API_PORT === '443')
  ? `http://${API_HOST}`
  : `http://${API_HOST}:${API_PORT}`;

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

const getAccessToken = async () => {
  if (isWebPlatform()) {
    return window.localStorage.getItem('access_token');
  }

  return await SecureStore.getItemAsync('access_token');
};

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
  appendNumberParam(params, 'size', filters.size ?? 20);

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
  const rawValue = isWebPlatform()
    ? window.localStorage.getItem(DISCOVERY_PREFERENCES_KEY)
    : await SecureStore.getItemAsync(DISCOVERY_PREFERENCES_KEY);

  if (!rawValue) {
    return normalizeDiscoveryPreferences(null);
  }

  try {
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
    const accessToken = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}${DISCOVERY_BASE_PATH}${buildDiscoveryQuery(filters)}`, {
      method: 'GET',
      headers: {
        Accept: '*/*',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
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
    const accessToken = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}${MATCHES_BASE_PATH}/${userId}/${action}`, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
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

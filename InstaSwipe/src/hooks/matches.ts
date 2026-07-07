import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_HOST = process.env.EXPO_PUBLIC_API_HOST;
const API_PORT = process.env.EXPO_PUBLIC_API_PORT;
const API_PREFIX_RAW = process.env.EXPO_PUBLIC_API_PREFIX || '/api';
const API_PREFIX = API_PREFIX_RAW.startsWith('/') ? API_PREFIX_RAW : `/${API_PREFIX_RAW}`;
const DISCOVERY_BASE_PATH = `${API_PREFIX}/discovery`;
const API_BASE_URL = (API_PORT === '80' || API_PORT === '443')
  ? `http://${API_HOST}`
  : `http://${API_HOST}:${API_PORT}`;

export type Gender = 'MALE' | 'FEMALE';

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
  gender?: Gender;
  country?: string;
  interests?: string[];
  page?: number;
  size?: number;
  sort?: string[];
}

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

const buildDiscoveryQuery = (filters: DiscoveryFilters = {}) => {
  const params = new URLSearchParams();

  appendNumberParam(params, 'minAge', filters.minAge);
  appendNumberParam(params, 'maxAge', filters.maxAge);
  appendStringParam(params, 'gender', filters.gender);
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

    return await response.json();
  }
}

export const getDiscovery = MatchAPI.getDiscovery;

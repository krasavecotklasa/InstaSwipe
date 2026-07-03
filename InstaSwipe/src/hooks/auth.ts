import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// On Android emulators, 'localhost' refers to the emulator itself.
// Use 10.0.2.2 to reach the host machine's loopback interface.
const DEFAULT_API_HOST = '10.48.89.66';
const API_HOST = process.env.EXPO_PUBLIC_API_HOST || DEFAULT_API_HOST;
const API_PORT = process.env.EXPO_PUBLIC_API_PORT || '8080';
const API_PREFIX_RAW = process.env.EXPO_PUBLIC_API_PREFIX || '/api';
const API_PREFIX = API_PREFIX_RAW.startsWith('/') ? API_PREFIX_RAW : `/${API_PREFIX_RAW}`;
const AUTH_BASE_PATH = `${API_PREFIX}/auth`;
const PROFILE_BASE_PATH = `${API_PREFIX}/profile`;
const API_BASE_URL = (API_PORT === '80' || API_PORT === '443')
  ? `http://${API_HOST}`
  : `http://${API_HOST}:${API_PORT}`;

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface UserMeResponse {
  email: string;
}

const getAccessToken = async () => await SecureStore.getItemAsync('access_token');
const getRefreshToken = async () => await SecureStore.getItemAsync('refresh_token');

const normalizeTokenValue = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Invalid token value');
  }

  return value;
};

const setTokens = async (accessToken: string, refreshToken: string) => {
  const normalizedAccessToken = normalizeTokenValue(accessToken);
  const normalizedRefreshToken = normalizeTokenValue(refreshToken);

  await SecureStore.setItemAsync('access_token', normalizedAccessToken);
  await SecureStore.setItemAsync('refresh_token', normalizedRefreshToken);
};

const clearTokens = async () => {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
};

const logout = async () => {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    try {
      await fetch(`${AUTH_BASE_PATH}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch (error) {
      console.warn('[Auth] Logout request failed', error);
    }
  }

  await clearTokens();
};

class API {
  private static async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const accessToken = await getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...((options.headers as any) || {}),
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const fullUrl = `${API_BASE_URL}${endpoint}`;
    console.log(`[API] ${options.method || 'GET'} ${fullUrl}`);

    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });

    console.log(`[API] Response: ${response.status} ${response.statusText}`);

    // Handle session expiry and refresh
    if (response.status === 401 && !endpoint.includes(`${AUTH_BASE_PATH}/`)) {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        const refreshResponse = await fetch(`${API_BASE_URL}${AUTH_BASE_PATH}/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshResponse.ok) {
          const data: AuthResponse = await refreshResponse.json();
          await setTokens(data.accessToken, data.refreshToken);

          // Retry original request with new token
          headers['Authorization'] = `Bearer ${data.accessToken}`;
          return fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
          });
        } else {
          await clearTokens();
        }
      }
    }

    return response;
  }

  static async register(payload: any): Promise<Response> {
    return this.request(`${AUTH_BASE_PATH}/register`, {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        email: payload.email.toLowerCase(),
        password: payload.password,
      }),
    });
  }

  static async login(payload: any): Promise<Response> {
    return this.request(`${AUTH_BASE_PATH}/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email.toLowerCase(),
        password: payload.password,
      }),
    });
  }
}

export { API, setTokens, clearTokens, getAccessToken, getRefreshToken, logout };
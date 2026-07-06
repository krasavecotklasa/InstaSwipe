import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// On Android emulators, 'localhost' refers to the emulator itself.
// Use 10.0.2.2 to reach the host machine's loopback interface.
const API_HOST = process.env.EXPO_PUBLIC_API_HOST;
const API_PORT = process.env.EXPO_PUBLIC_API_PORT;
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

export interface ProfileStatusResponse {
  email: string;
  needsOnboarding: boolean;
  emailVerified: boolean;
}

// FIX: Platform.OS is the only reliable signal. `typeof window` can be
// truthy on native too (e.g. remote JS debugging via Chrome), which used
// to make native builds think they were "web" and read/write tokens via
// localStorage instead of SecureStore -- silently breaking auth on device.
const isWebPlatform = () => Platform.OS === 'web';

const getAccessToken = async () => {
  if (isWebPlatform()) {
    return window.localStorage.getItem('access_token');
  }
  return await SecureStore.getItemAsync('access_token');
};

const getRefreshToken = async () => {
  if (isWebPlatform()) {
    return window.localStorage.getItem('refresh_token');
  }
  return await SecureStore.getItemAsync('refresh_token');
};

const normalizeTokenValue = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Invalid token value');
  }

  return value;
};

const setTokens = async (accessToken: string, refreshToken: string) => {
  const normalizedAccessToken = normalizeTokenValue(accessToken);
  const normalizedRefreshToken = normalizeTokenValue(refreshToken);

  if (isWebPlatform()) {
    window.localStorage.setItem('access_token', normalizedAccessToken);
    window.localStorage.setItem('refresh_token', normalizedRefreshToken);
  } else {
    await SecureStore.setItemAsync('access_token', normalizedAccessToken);
    await SecureStore.setItemAsync('refresh_token', normalizedRefreshToken);
  }
};

const clearTokens = async () => {
  if (isWebPlatform()) {
    window.localStorage.removeItem('access_token');
    window.localStorage.removeItem('refresh_token');
  } else {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
  }
};

const logout = async () => {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    try {
      // FIX: this was missing API_BASE_URL, so it fetched a relative path.
      // On web that silently hit the wrong origin; on native there's no
      // origin to resolve against at all, so it always failed.
      await fetch(`${API_BASE_URL}${AUTH_BASE_PATH}/logout`, {
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

const isFormDataBody = (body: unknown): body is FormData => {
  return typeof FormData !== 'undefined' && body instanceof FormData;
};

class API {
  private static async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const accessToken = await getAccessToken();
    const headers: any = {
      ...((options.headers as any) || {}),
    };

    if (!headers['Content-Type'] && !isFormDataBody(options.body)) {
      headers['Content-Type'] = 'application/json';
    }

    if (isFormDataBody(options.body)) {
      delete headers['Content-Type'];
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const fullUrl = `${API_BASE_URL}${endpoint}`;
    console.log(`[API] ${options.method || 'GET'} ${fullUrl}`);

    let response: Response;
    try {
      response = await fetch(fullUrl, {
        ...options,
        headers,
      });
    } catch (error) {
      // FIX: previously an unreachable host / network failure / bad
      // FormData part propagated as a bare, often opaque error. Surface
      // something the caller (and you, in the console) can actually act on.
      console.error(`[API] Network request to ${fullUrl} failed:`, error);
      throw new Error(
        `Could not reach the server at ${API_HOST}:${API_PORT}. Check that the API is running and reachable from this device, and that EXPO_PUBLIC_API_HOST is set correctly.`
      );
    }

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

  static async getProfileStatus(): Promise<Response> {
    return this.request(`${PROFILE_BASE_PATH}/status`, {
      method: 'GET',
    });
  }

  static async updateProfile(payload: FormData): Promise<Response> {
    return this.request(`${PROFILE_BASE_PATH}/update`, {
      method: 'PUT',
      body: payload,
    });
  }
}

export { API, setTokens, clearTokens, getAccessToken, getRefreshToken, logout };

export const getProfileUpdateUrl = () => `${API_BASE_URL}${PROFILE_BASE_PATH}/update`;
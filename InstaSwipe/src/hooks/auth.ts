import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { MediaStatus } from '@/components/post-card';
import {
  API_HOST,
  API_PORT,
  API_BASE_URL,
  AUTH_BASE_PATH,
  PROFILE_BASE_PATH
} from '@/hooks/api';

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

interface AuthTokenResponse {
  accessToken?: unknown;
  refreshToken?: unknown;
  access_token?: unknown;
  refresh_token?: unknown;
}

export interface UserMeResponse {
  email: string;
}

export interface ProfileStatusResponse {
  email: string;
  needsOnboarding: boolean;
  emailVerified: boolean;
}

export interface OwnProfileResponse {
  id?: string;
  userId?: string;
  email: string;
  displayName: string;
  bio: string;
  birthDate: string;
  country: string;
  gender: string;
  interests: string[];
  profilePictureUrl: string | null;
  profilePictureStatus: MediaStatus | null;
}

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

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Standard base64 decode with a pure-JS fallback: `atob` is not guaranteed to be
// a global in every React Native / Hermes build, and a JWT payload is ASCII JSON,
// so we don't need UTF-8 handling here.
const decodeBase64 = (input: string): string => {
  if (typeof atob === 'function') {
    return atob(input);
  }
  const str = input.replace(/=+$/, '');
  let output = '';
  let bc = 0;
  let bs = 0;
  for (let i = 0; i < str.length; i++) {
    const idx = BASE64_CHARS.indexOf(str.charAt(i));
    if (idx === -1) {
      continue;
    }
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
  }
  return output;
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(decodeBase64(padded));
  } catch {
    return null;
  }
};

// Reads the "sub" claim (the user id) out of the access token. The backend uses
// the same claim as the authenticated principal, so this is the id the chat
// senderId must match. OwnProfileResponse does not expose the id, hence decoding.
const decodeJwtSubject = (token: string): string | null => {
  const claims = decodeJwtPayload(token);
  return typeof claims?.sub === 'string' ? claims.sub : null;
};

// The STOMP session (hooks/chat.ts) needs to know exactly when its access token
// expires so it can proactively refresh/reconnect before the backend's
// WebSocketAuthInterceptor starts rejecting frames against a stale session.
const getJwtExpiryMs = (token: string): number | null => {
  const claims = decodeJwtPayload(token);
  return typeof claims?.exp === 'number' ? claims.exp * 1000 : null;
};

const getCurrentUserId = async (): Promise<string | null> => {
  const token = await getAccessToken();
  return token ? decodeJwtSubject(token) : null;
};

const normalizeTokenValue = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Invalid token value');
  }

  return value;
};

const getAuthTokensFromResponse = (data: AuthTokenResponse) => {
  const accessToken = normalizeTokenValue(data.accessToken ?? data.access_token);
  const refreshToken = normalizeTokenValue(data.refreshToken ?? data.refresh_token);

  return { accessToken, refreshToken };
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
        body: JSON.stringify({ refreshToken }),
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

// Exchanges the stored refresh token for a new access token, persisting both.
// Returns null (and clears the session) if there is no refresh token or the
// backend rejects it, matching the failure handling authorizedFetch already did.
const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const refreshResponse = await fetch(`${API_BASE_URL}${AUTH_BASE_PATH}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!refreshResponse.ok) {
    await clearTokens();
    return null;
  }

  try {
    const data: AuthTokenResponse = await refreshResponse.json();
    const tokens = getAuthTokensFromResponse(data);
    await setTokens(tokens.accessToken, tokens.refreshToken);
    return tokens.accessToken;
  } catch (error) {
    console.warn('[Auth] Refresh response did not include valid tokens', error);
    await clearTokens();
    return null;
  }
};

// The access token's lifetime is short (15 minutes by default); a caller that's
// about to hold a session open (e.g. a STOMP connection) should call this
// instead of getAccessToken() to avoid handing over a token that's already
// expired or about to expire mid-use.
const TOKEN_EXPIRY_BUFFER_MS = 30_000;

export const ensureFreshAccessToken = async (): Promise<string | null> => {
  const token = await getAccessToken();
  if (token) {
    const expiresAt = getJwtExpiryMs(token);
    if (expiresAt === null || expiresAt - Date.now() > TOKEN_EXPIRY_BUFFER_MS) {
      return token;
    }
  }
  return refreshAccessToken();
};

export { getJwtExpiryMs };

// Shared authenticated fetch: attaches the bearer token and, on a 401, refreshes
// the session once and retries. Every authenticated caller (auth, discovery,
// matches, posts, notifications) must go through this so token expiry is handled
// in one place instead of surfacing as a raw 401 on individual screens.
export const authorizedFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
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
    console.error(`[API] Network request to ${fullUrl} failed:`, error);
    throw new Error(
      `Could not reach the server at ${API_HOST}:${API_PORT}. Check that the API is running and reachable from this device, and that EXPO_PUBLIC_API_HOST is set correctly.`
    );
  }

  console.log(`[API] Response: ${response.status} ${response.statusText}`);

  // Handle session expiry and refresh
  if (response.status === 401 && !endpoint.includes(`${AUTH_BASE_PATH}/`)) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      // Retry original request with new token
      headers['Authorization'] = `Bearer ${newAccessToken}`;
      return fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    }
  }

  return response;
};

class API {
  private static async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    return authorizedFetch(endpoint, options);
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

  static async forgotPassword(payload: { email: string }): Promise<Response> {
    return this.request(`${AUTH_BASE_PATH}/password/forgot`, {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email.toLowerCase(),
      }),
    });
  }

  static async verifyPasswordReset(payload: { email: string; otpToken: string }): Promise<Response> {
    return this.request(`${AUTH_BASE_PATH}/password/verify`, {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email.toLowerCase(),
        code: payload.otpToken,
      }),
    });
  }

  static async resetPassword(payload: { email: string; otpToken: string; newPassword: string }): Promise<Response> {
    return this.request(`${AUTH_BASE_PATH}/password/reset`, {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email.toLowerCase(),
        code: payload.otpToken,
        newPassword: payload.newPassword,
        password: payload.newPassword,
      }),
    });
  }

  static async verifyEmail(payload: { email: string; code: string }): Promise<Response> {
    return this.request(`${AUTH_BASE_PATH}/verify-email`, {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email.toLowerCase(),
        code: payload.code,
      }),
    });
  }

  static async resendVerification(payload: { email: string }): Promise<Response> {
    return this.request(`${AUTH_BASE_PATH}/resend-verification`, {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email.toLowerCase(),
      }),
    });
  }

  static async getProfileStatus(): Promise<Response> {
    return this.request(`${PROFILE_BASE_PATH}/status`, {
      method: 'GET',
    });
  }

  static async getOwnProfile(): Promise<Response> {
    return this.request(`${PROFILE_BASE_PATH}/me`, {
      method: 'GET',
    });
  }

  static async updateProfile(payload: FormData): Promise<Response> {
    return this.request(`${PROFILE_BASE_PATH}/update`, {
      method: 'PUT',
      body: payload,
    });
  }

  static async changePassword(payload: { oldPassword: string; newPassword: string }): Promise<Response> {
    return this.request(`${PROFILE_BASE_PATH}/password`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
}

export { API, setTokens, clearTokens, getAccessToken, getRefreshToken, getCurrentUserId, logout };

export const getProfileUpdateUrl = () => `${API_BASE_URL}${PROFILE_BASE_PATH}/update`;

export interface ProfilePictureUploadResult {
  url: string;
  status: MediaStatus;
}

export const uploadProfilePicture = async (
  image: { uri: string; mimeType?: string },
): Promise<ProfilePictureUploadResult> => {
  const url = `${API_BASE_URL}${PROFILE_BASE_PATH}/picture`;
  const filename = image.uri.split('/').pop() || 'profile.jpg';
  const inferredType =
    image.mimeType || (filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

  if (Platform.OS !== 'web') {
    const FileSystem = await import('expo-file-system/legacy');
    const token = await getAccessToken();
    const uploadResult = await FileSystem.uploadAsync(url, image.uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: inferredType,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (uploadResult.status === 429) {
      throw new Error('Too many picture changes. Please try again later.');
    }
    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      let message = 'Could not upload your picture';
      try {
        message = JSON.parse(uploadResult.body).message || message;
      } catch {
        // Leave the default message.
      }
      throw new Error(message);
    }
    return JSON.parse(uploadResult.body);
  }

  const accessToken = await getAccessToken();
  const res = await fetch(image.uri);
  const blob = await res.blob();
  const formData = new FormData();
  formData.append('file', blob, filename);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: formData,
  });

  if (response.status === 429) {
    throw new Error('Too many picture changes. Please try again later.');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Could not upload your picture');
  }

  return response.json();
};

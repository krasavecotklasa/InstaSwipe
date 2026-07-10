export const API_HOST = process.env.EXPO_PUBLIC_API_HOST;
export const API_PORT = process.env.EXPO_PUBLIC_API_PORT;
export const API_PREFIX_RAW = process.env.EXPO_PUBLIC_API_PREFIX || '/api';
export const API_PREFIX = API_PREFIX_RAW.startsWith('/') ? API_PREFIX_RAW : `/${API_PREFIX_RAW}`;
export const AUTH_BASE_PATH = `${API_PREFIX}/auth`;
export const PROFILE_BASE_PATH = `${API_PREFIX}/profile`;
export const POSTS_BASE_PATH = `${API_PREFIX}/posts`;
export const SEARCH_BASE_PATH = `${API_PREFIX}/search`;
export const API_BASE_URL = (API_PORT === '80' || API_PORT === '443')
  ? `http://${API_HOST}`
  : `http://${API_HOST}:${API_PORT}`;

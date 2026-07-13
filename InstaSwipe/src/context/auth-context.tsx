import { createContext, useContext } from 'react';
import type { OwnProfileResponse } from '@/hooks/auth';

interface AuthContextValue {
  /** Call this after successfully storing tokens to dismiss the auth modal. */
  onAuthSuccess: () => void;
  /** Call this when the user logs out. */
  onLogout: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  onAuthSuccess: () => {},
  onLogout: () => {},
});

export const useAuthContext = () => useContext(AuthContext);

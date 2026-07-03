import React, { createContext, useContext } from 'react';

interface AuthContextValue {
  /** Call this after successfully storing tokens to dismiss the auth modal. */
  onAuthSuccess: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  onAuthSuccess: () => {},
});

export const useAuthContext = () => useContext(AuthContext);

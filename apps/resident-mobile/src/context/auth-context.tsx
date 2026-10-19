import React, { createContext, useContext, useState, useEffect } from 'react';
import { mobileApi } from '../services/api.js';

export interface ResidentUser {
  id: string;
  username: string;
  role: string;
  namaLengkap: string;
  blokRumah: string;
  nomorKkMasked?: string;
}

interface AuthContextType {
  user: ResidentUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithRecovery: (username: string, recoveryCode: string) => Promise<void>;
  setAuthSession: (token: string, user: ResidentUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ResidentUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('simrt_mobile_access_token');
    const savedUser = localStorage.getItem('simrt_mobile_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        mobileApi.setToken(savedToken);
      } catch {
        localStorage.removeItem('simrt_mobile_access_token');
        localStorage.removeItem('simrt_mobile_user');
      }
    }

    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
      mobileApi.setToken(null);
      localStorage.removeItem('simrt_mobile_access_token');
      localStorage.removeItem('simrt_mobile_user');
    };

    window.addEventListener('simrt:unauthorized', handleUnauthorized);
    setIsLoading(false);

    return () => {
      window.removeEventListener('simrt:unauthorized', handleUnauthorized);
    };
  }, []);

  const setAuthSession = (newToken: string, newUser: ResidentUser) => {
    setToken(newToken);
    setUser(newUser);
    mobileApi.setToken(newToken);
    localStorage.setItem('simrt_mobile_access_token', newToken);
    localStorage.setItem('simrt_mobile_user', JSON.stringify(newUser));
  };

  const login = async (usernameInput: string, passwordInput: string) => {
    const res = await mobileApi.post<{
      accessToken: string;
      user: {
        id: string;
        username: string;
        role: string;
        namaLengkap?: string;
        blokRumah?: string;
      };
    }>('/auth/login', {
      username: usernameInput,
      password: passwordInput,
    });

    const residentUser: ResidentUser = {
      id: res.user.id,
      username: res.user.username,
      role: res.user.role,
      namaLengkap: res.user.namaLengkap || res.user.username,
      blokRumah: res.user.blokRumah || 'Blok RT 05',
    };

    setAuthSession(res.accessToken, residentUser);
  };

  const loginWithRecovery = async (usernameInput: string, recoveryCodeInput: string) => {
    const res = await mobileApi.post<{
      accessToken: string;
      user: {
        id: string;
        username: string;
        role: string;
        namaLengkap?: string;
        blokRumah?: string;
      };
    }>('/auth/recovery-login', {
      username: usernameInput,
      recoveryCode: recoveryCodeInput,
    });

    const residentUser: ResidentUser = {
      id: res.user.id,
      username: res.user.username,
      role: res.user.role,
      namaLengkap: res.user.namaLengkap || res.user.username,
      blokRumah: res.user.blokRumah || 'Blok RT 05',
    };

    setAuthSession(res.accessToken, residentUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    mobileApi.setToken(null);
    localStorage.removeItem('simrt_mobile_access_token');
    localStorage.removeItem('simrt_mobile_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        loginWithRecovery,
        setAuthSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

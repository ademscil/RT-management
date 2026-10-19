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
  isElderMode: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithRecovery: (username: string, recoveryCode: string) => Promise<void>;
  setAuthSession: (token: string, user: ResidentUser) => void;
  logout: () => void;
  toggleElderMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ResidentUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isElderMode, setIsElderMode] = useState<boolean>(() => {
    return localStorage.getItem('simrt_elder_mode') === 'true';
  });

  useEffect(() => {
    if (isElderMode) {
      document.body.classList.add('text-elder');
    } else {
      document.body.classList.remove('text-elder');
    }
  }, [isElderMode]);

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
    };

    window.addEventListener('simrt_unauthorized', handleUnauthorized);
    setIsLoading(false);

    return () => {
      window.removeEventListener('simrt_unauthorized', handleUnauthorized);
    };
  }, []);

  const setAuthSession = (newToken: string, newUser: ResidentUser) => {
    setToken(newToken);
    setUser(newUser);
    mobileApi.setToken(newToken);
    localStorage.setItem('simrt_mobile_access_token', newToken);
    localStorage.setItem('simrt_mobile_user', JSON.stringify(newUser));
  };

  const login = async (username: string, password: string) => {
    const res = await mobileApi.post<{
      accessToken: string;
      user: {
        id: string;
        username: string;
        role: string;
        namaLengkap: string;
        blokRumah?: string;
      };
    }>('/auth/login', { username, password });

    const residentUser: ResidentUser = {
      id: res.user.id,
      username: res.user.username,
      role: res.user.role,
      namaLengkap: res.user.namaLengkap,
      blokRumah: res.user.blokRumah || 'Blok RT 05',
    };

    setAuthSession(res.accessToken, residentUser);
  };

  const loginWithRecovery = async (username: string, recoveryCode: string) => {
    const res = await mobileApi.post<{
      accessToken: string;
      user: {
        id: string;
        username: string;
        role: string;
        namaLengkap: string;
        blokRumah?: string;
      };
    }>('/auth/recovery-login', { username, recoveryCode });

    const residentUser: ResidentUser = {
      id: res.user.id,
      username: res.user.username,
      role: res.user.role,
      namaLengkap: res.user.namaLengkap,
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

  const toggleElderMode = () => {
    setIsElderMode((prev) => {
      const next = !prev;
      localStorage.setItem('simrt_elder_mode', String(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        isElderMode,
        login,
        loginWithRecovery,
        setAuthSession,
        logout,
        toggleElderMode,
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

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { UserRole } from '@simrt/shared-types';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  namaLengkap: string;
  wargaId: string;
  kkId: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.get<{
          id: string;
          username: string;
          role: UserRole;
          warga: { namaLengkap: string; id: string; blokRumah: string };
        }>('/auth/me');

        setUser({
          id: data.id,
          username: data.username,
          role: data.role,
          namaLengkap: data.warga.namaLengkap,
          wargaId: data.warga.id,
          kkId: '',
        });
      } catch {
        api.setToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, [token]);

  const login = async (username: string, password: string) => {
    const res = await api.post<{
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        username: string;
        role: UserRole;
        namaLengkap: string;
        wargaId: string;
        kkId: string;
      };
    }>('/auth/login', { username, password });

    api.setToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
  };

  const logout = () => {
    api.setToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

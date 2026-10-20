import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';

export interface RtConfig {
  id?: string;
  kodeRt: string;
  kodeRw: string;
  namaKelurahan: string;
  namaKecamatan: string;
  namaKota: string;
  kodePos: string;
  displayTitle: string;
  displaySub: string;
  displayFull: string;
}

export const DEFAULT_RT_CONFIG: RtConfig = {
  kodeRt: '010',
  kodeRw: '003',
  namaKelurahan: 'Taman Bunga',
  namaKecamatan: 'Gerunggang',
  namaKota: 'Kota Pangkalpinang',
  kodePos: '33119',
  displayTitle: 'RT 010 / RW 003',
  displaySub: 'Kel. Taman Bunga, Kec. Gerunggang, Kota Pangkalpinang',
  displayFull: 'RT 010 / RW 003 Kel. Taman Bunga, Kec. Gerunggang, Kota Pangkalpinang 33119',
};

interface RtConfigContextType {
  config: RtConfig;
  isLoading: boolean;
  refreshConfig: () => Promise<void>;
  updateConfig: (newConfig: Partial<RtConfig>) => Promise<void>;
}

const RtConfigContext = createContext<RtConfigContextType | null>(null);

export const RtConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<RtConfig>(DEFAULT_RT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const res = await api.get<any>('/config/rt');
      const data = res?.data || res;
      if (data && data.kodeRt) {
        setConfig(data);
      }
    } catch (err) {
      console.warn('Could not fetch dynamic RT config, using defaults:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const updateConfig = async (newConfig: Partial<RtConfig>) => {
    const res = await api.put<any>('/config/rt', newConfig);
    const data = res?.data || res;
    if (data && data.kodeRt) {
      setConfig(data);
    }
  };

  return (
    <RtConfigContext.Provider
      value={{
        config,
        isLoading,
        refreshConfig: fetchConfig,
        updateConfig,
      }}
    >
      {children}
    </RtConfigContext.Provider>
  );
};

export const useRtConfig = () => {
  const context = useContext(RtConfigContext);
  if (!context) {
    return {
      config: DEFAULT_RT_CONFIG,
      isLoading: false,
      refreshConfig: async () => {},
      updateConfig: async () => {},
    };
  }
  return context;
};

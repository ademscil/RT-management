import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mobileApi } from '../services/api.js';

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
  id: 'default-tb-pkp',
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
  rtList: RtConfig[];
  isLoading: boolean;
  refreshConfig: () => Promise<void>;
  switchRt: (rtId: string) => Promise<void>;
}

const RtConfigContext = createContext<RtConfigContextType | null>(null);

export const RtConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<RtConfig>(DEFAULT_RT_CONFIG);
  const [rtList, setRtList] = useState<RtConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const listRes = await mobileApi.get<any>('/config/rt/list');
      const listData = Array.isArray(listRes?.data) ? listRes.data : Array.isArray(listRes) ? listRes : [];
      if (listData.length > 0) {
        setRtList(listData);
      }

      const savedRtId = localStorage.getItem('simrt_active_rt_id');
      const queryParam = savedRtId ? `?rtId=${savedRtId}` : '';
      const res = await mobileApi.get<any>(`/config/rt${queryParam}`);
      const data = res?.data || res;
      if (data && data.kodeRt) {
        setConfig(data);
        if (data.id) {
          localStorage.setItem('simrt_active_rt_id', data.id);
        }
      }
    } catch (err) {
      console.warn('Could not fetch dynamic RT config in mobile app:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const switchRt = async (rtId: string) => {
    const target = rtList.find((r) => r.id === rtId);
    if (target) {
      setConfig(target);
      localStorage.setItem('simrt_active_rt_id', rtId);
    }
  };

  return (
    <RtConfigContext.Provider
      value={{
        config,
        rtList,
        isLoading,
        refreshConfig: fetchConfig,
        switchRt,
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
      rtList: [DEFAULT_RT_CONFIG],
      isLoading: false,
      refreshConfig: async () => {},
      switchRt: async () => {},
    };
  }
  return context;
};

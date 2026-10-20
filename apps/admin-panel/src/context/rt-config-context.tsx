import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  activeRtId: string | null;
  isLoading: boolean;
  refreshConfig: () => Promise<void>;
  switchRt: (rtId: string) => Promise<void>;
  createRt: (newRt: Partial<RtConfig>) => Promise<RtConfig>;
  deleteRt: (rtId: string) => Promise<void>;
  updateConfig: (newConfig: Partial<RtConfig>) => Promise<void>;
}

const RtConfigContext = createContext<RtConfigContextType | null>(null);

export const RtConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<RtConfig>(DEFAULT_RT_CONFIG);
  const [rtList, setRtList] = useState<RtConfig[]>([]);
  const [activeRtId, setActiveRtId] = useState<string | null>(() => localStorage.getItem('simrt_active_rt_id'));
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const currentRtId = localStorage.getItem('simrt_active_rt_id');
      const queryParam = currentRtId ? `?rtId=${currentRtId}` : '';

      const [listResult, configResult] = await Promise.allSettled([
        api.get<any>('/config/rt/list'),
        api.get<any>(`/config/rt${queryParam}`),
      ]);

      if (listResult.status === 'fulfilled') {
        const listData = Array.isArray(listResult.value?.data)
          ? listResult.value.data
          : Array.isArray(listResult.value)
          ? listResult.value
          : [];
        if (listData.length > 0) {
          setRtList(listData);
        }
      }

      if (configResult.status === 'fulfilled') {
        const data = configResult.value?.data || configResult.value;
        if (data && data.kodeRt) {
          setConfig(data);
          if (data.id) {
            setActiveRtId(data.id);
            localStorage.setItem('simrt_active_rt_id', data.id);
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch dynamic RT config, using defaults:', err);
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
      setActiveRtId(rtId);
      localStorage.setItem('simrt_active_rt_id', rtId);
      api.invalidateCache();
    } else {
      try {
        const res = await api.get<any>(`/config/rt?rtId=${rtId}`);
        const data = res?.data || res;
        if (data && data.kodeRt) {
          setConfig(data);
          setActiveRtId(rtId);
          localStorage.setItem('simrt_active_rt_id', rtId);
          api.invalidateCache();
        }
      } catch (err) {
        console.error('Failed switching RT:', err);
      }
    }
  };

  const createRt = async (newRt: Partial<RtConfig>): Promise<RtConfig> => {
    const res = await api.post<any>('/config/rt', newRt);
    const data = res?.data || res;
    if (data && data.kodeRt) {
      setRtList((prev) => [...prev, data]);
      await switchRt(data.id);
      return data;
    }
    throw new Error('Gagal mendaftarkan RT baru.');
  };

  const deleteRt = async (rtId: string) => {
    await api.delete<any>(`/config/rt/${rtId}`);
    setRtList((prev) => prev.filter((r) => r.id !== rtId));
    if (config.id === rtId) {
      const remaining = rtList.filter((r) => r.id !== rtId);
      if (remaining.length > 0) {
        await switchRt(remaining[0].id || '');
      }
    }
  };

  const updateConfig = async (newConfig: Partial<RtConfig>) => {
    const targetId = config.id || activeRtId;
    const url = targetId ? `/config/rt/${targetId}` : '/config/rt';
    const res = await api.put<any>(url, { ...newConfig, id: targetId });
    const data = res?.data || res;
    if (data && data.kodeRt) {
      setConfig(data);
      setRtList((prev) =>
        prev.map((item) => (item.id === data.id ? { ...item, ...data } : item))
      );
    }
  };

  return (
    <RtConfigContext.Provider
      value={{
        config,
        rtList,
        activeRtId,
        isLoading,
        refreshConfig: fetchConfig,
        switchRt,
        createRt,
        deleteRt,
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
      rtList: [DEFAULT_RT_CONFIG],
      activeRtId: null,
      isLoading: false,
      refreshConfig: async () => {},
      switchRt: async () => {},
      createRt: async () => DEFAULT_RT_CONFIG,
      deleteRt: async () => {},
      updateConfig: async () => {},
    };
  }
  return context;
};

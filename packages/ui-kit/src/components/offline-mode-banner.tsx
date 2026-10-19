import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineModeBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-amber-950 text-xs font-semibold shadow-md animate-in slide-in-from-top">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Anda sedang offline. Menampilkan data Kartu Keluarga & Surat dari penyimpanan lokal.</span>
    </div>
  );
};

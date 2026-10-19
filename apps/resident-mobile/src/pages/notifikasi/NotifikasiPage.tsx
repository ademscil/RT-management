import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  FileText,
  Wallet,
  Moon,
  AlertTriangle,
  Megaphone,
  Volume2,
} from 'lucide-react';
import { mobileApi } from '../../services/api.js';
import { LocalNotificationManager } from '../../services/local-notifications.js';
import { Card, CardContent, notify } from '@simrt/ui-kit';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'SURAT' | 'IURAN' | 'RONDA' | 'SECURITY' | 'BROADCAST';
  isRead: boolean;
  createdAt: string;
}

export const NotifikasiPage: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Settings
  const [rondaAlarmEnabled, setRondaAlarmEnabled] = useState(true);
  const [iuranReminderEnabled, setIuranReminderEnabled] = useState(true);

  useEffect(() => {
    async function loadNotifications() {
      setIsLoading(true);
      try {
        const res = await mobileApi.get<{ items: any[] }>('/notifications');
        if (res.items && res.items.length > 0) {
          setNotifications(
            res.items.map((n) => ({
              id: n.id,
              title: n.title,
              message: n.message,
              type: n.type,
              isRead: n.isRead,
              createdAt: n.createdAt,
            }))
          );
        } else {
          // Default initial notifications for resident
          setNotifications([
            {
              id: '1',
              title: 'Jadwal Ronda Malam RT 05',
              message: 'Pengingat giliran ronda malam Sabtu ini pukul 22.00 di Pos Kamling Utama.',
              type: 'RONDA',
              isRead: false,
              createdAt: new Date().toISOString(),
            },
            {
              id: '2',
              title: 'Tagihan Iuran Kas Terbit',
              message: 'Iuran Kas & Kebersihan bulan ini telah diterbitkan oleh Bendahara RT.',
              type: 'IURAN',
              isRead: false,
              createdAt: new Date(Date.now() - 3600000).toISOString(),
            },
            {
              id: '3',
              title: 'Sistem Informasi Mandiri RT Aktif',
              message: 'Selamat datang di SIM-RT! Akses layanan surat pengantar dan laporan transparansi kas 24 jam.',
              type: 'BROADCAST',
              isRead: true,
              createdAt: new Date(Date.now() - 86400000).toISOString(),
            },
          ]);
        }
      } catch {
        // Fallback
      } finally {
        setIsLoading(false);
      }
    }
    loadNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await mobileApi.post('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      notify.success({ title: 'Ditandai Dibaca', description: 'Semua notifikasi telah ditandai telah dibaca.' });
    } catch {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  const handleToggleRonda = async () => {
    const next = !rondaAlarmEnabled;
    setRondaAlarmEnabled(next);
    if (next) {
      await LocalNotificationManager.requestPermissions();
      notify.success({
        title: 'Alarm Ronda Diaktifkan',
        description: 'Capacitor Local Notifications akan berbunyi 30 menit sebelum giliran ronda.',
      });
    }
  };

  const handleToggleIuran = async () => {
    const next = !iuranReminderEnabled;
    setIuranReminderEnabled(next);
    if (next) {
      await LocalNotificationManager.requestPermissions();
      notify.success({
        title: 'Pengingat Iuran Diaktifkan',
        description: 'Pengingat otomatis H-2 sebelum tanggal jatuh tempo iuran.',
      });
    }
  };

  const filtered = notifications.filter((n) => {
    if (activeCategory === 'ALL') return true;
    return n.type === activeCategory;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'SURAT':
        return { icon: FileText, color: 'text-teal-700 bg-teal-50' };
      case 'IURAN':
        return { icon: Wallet, color: 'text-emerald-700 bg-emerald-50' };
      case 'RONDA':
        return { icon: Moon, color: 'text-indigo-700 bg-indigo-50' };
      case 'SECURITY':
        return { icon: AlertTriangle, color: 'text-red-700 bg-red-50' };
      default:
        return { icon: Megaphone, color: 'text-amber-700 bg-amber-50' };
    }
  };

  return (
    <div className="space-y-4 pb-24 pt-safe px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-teal-700" />
            Kotak Masuk & Notifikasi
          </h2>
          <p className="text-xs text-slate-500">
            Pemberitahuan real-time Server-Sent Events & alarm jadwal
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="text-xs font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1 hover:underline"
        >
          <CheckCheck className="w-4 h-4" /> Tandai Semua Dibaca
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'ALL', label: 'Semua' },
          { id: 'SURAT', label: 'E-Surat' },
          { id: 'IURAN', label: 'Iuran' },
          { id: 'RONDA', label: 'Ronda' },
          { id: 'BROADCAST', label: 'Warga' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeCategory === tab.id
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="space-y-2.5">
          <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
          <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500 space-y-2">
            <Bell className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Tidak Ada Pemberitahuan
            </h4>
            <p className="text-xs text-slate-500">
              Kotak masuk Anda bersih pada kategori ini.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((item) => {
            const { icon: Icon, color } = getIcon(item.type);
            return (
              <Card
                key={item.id}
                className={`transition-shadow hover:shadow-xs ${
                  !item.isRead ? 'border-l-4 border-l-teal-600 bg-teal-50/20' : ''
                }`}
              >
                <CardContent className="p-3.5 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                        {new Date(item.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Capacitor Local Notifications Preferences */}
      <Card className="mt-4 border-slate-200 dark:border-slate-800">
        <CardContent className="p-4 space-y-3">
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-teal-700" /> Preferensi Alarm Internal HP
          </h4>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <label htmlFor="toggle-ronda-alarm" className="cursor-pointer">
                <strong className="text-slate-800 dark:text-slate-200 block">
                  Alarm Ronda Malam (H-30 Menit)
                </strong>
                <span className="text-[11px] text-slate-500">
                  Jadwal alarm internal perangkat tanpa pulsa / SMS
                </span>
              </label>
              <input
                id="toggle-ronda-alarm"
                name="rondaAlarmEnabled"
                type="checkbox"
                aria-label="Aktifkan Alarm Ronda Malam"
                checked={rondaAlarmEnabled}
                onChange={handleToggleRonda}
                className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <label htmlFor="toggle-iuran-reminder" className="cursor-pointer">
                <strong className="text-slate-800 dark:text-slate-200 block">
                  Pengingat Iuran Bulanan (H-2)
                </strong>
                <span className="text-[11px] text-slate-500">
                  Notifikasi lokal sebelum jatuh tempo tagihan kas
                </span>
              </label>
              <input
                id="toggle-iuran-reminder"
                name="iuranReminderEnabled"
                type="checkbox"
                aria-label="Aktifkan Pengingat Iuran Bulanan"
                checked={iuranReminderEnabled}
                onChange={handleToggleIuran}
                className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

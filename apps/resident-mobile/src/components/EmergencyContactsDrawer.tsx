import React from 'react';
import { Phone, ShieldAlert, Flame, Ambulance, X, Building2 } from 'lucide-react';
import { Button } from '@simrt/ui-kit';

interface EmergencyContactsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyContactsDrawer: React.FC<EmergencyContactsDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const contacts = [
    {
      title: 'Ketua RT 05 (Bpk. Bambang)',
      desc: 'Blok A1-01 • Koordinasi Utama Lingkungan',
      tel: 'tel:081234567890',
      icon: Building2,
      color: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    {
      title: 'Pos Keamanan / Satpam 24 Jam',
      desc: 'Gerbang Utama • Patroli & Tanggap Insiden',
      tel: 'tel:081298765432',
      icon: ShieldAlert,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      title: 'Pemadam Kebakaran (Damkar)',
      desc: 'Pos Damkar Cilodong • Telepon Darurat 113',
      tel: 'tel:113',
      icon: Flame,
      color: 'bg-red-50 text-red-700 border-red-200',
    },
    {
      title: 'Ambulans & Gawat Darurat Medis',
      desc: 'PSC 119 Kota Depok / RSUD',
      tel: 'tel:119',
      icon: Ambulance,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom pb-safe border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
              <Phone className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Kontak Darurat RT 05</h3>
              <p className="text-xs text-slate-500">Bantuan cepat medis, keamanan & bencana</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {contacts.map((c, i) => {
            const Icon = c.icon;
            return (
              <a
                key={i}
                href={c.tel}
                className={`flex items-center justify-between p-3.5 rounded-2xl border ${c.color} hover:opacity-90 transition-opacity`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/80 dark:bg-slate-800 flex items-center justify-center shadow-xs">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{c.title}</h4>
                    <p className="text-[11px] text-slate-500">{c.desc}</p>
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-xs text-xs font-black">
                  Hubungi
                </div>
              </a>
            );
          })}
        </div>

        <Button variant="outline" size="md" className="w-full" onClick={onClose}>
          Tutup
        </Button>
      </div>
    </div>
  );
};

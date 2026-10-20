import React from 'react';
import { useRtConfig } from '../context/rt-config-context.js';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  variant?: 'light' | 'dark' | 'auto';
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
  variant = 'auto',
}) => {
  const { config } = useRtConfig();
  const pixelSizes = {
    sm: 32,
    md: 40,
    lg: 56,
    xl: 72,
  };

  const dim = pixelSizes[size] || 40;

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Precision SVG Vector Emblem */}
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform active:scale-95 drop-shadow-md"
        aria-label={`Logo Resmi SIM-RT ${config.kodeRt}`}
      >
        <defs>
          {/* Civic Teal & Emerald Gradient */}
          <linearGradient id="simrt-shield-grad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0D9488" />
            <stop offset="60%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#115E59" />
          </linearGradient>

          {/* Golden Radiance Accent */}
          <linearGradient id="simrt-gold-grad" x1="16" y1="12" x2="32" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          {/* Roof & Pillars Highlight */}
          <linearGradient id="simrt-roof-grad" x1="12" y1="14" x2="36" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#CCFBF1" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="simrt-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0F766E" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* 1. Civic Shield Contour (Protection, Harmony & Privacy) */}
        <path
          d="M24 3C32.5 3 41 6.5 41 15C41 28.5 31.5 38.5 24 43C16.5 38.5 7 28.5 7 15C7 6.5 15.5 3 24 3Z"
          fill="url(#simrt-shield-grad)"
          filter="url(#simrt-glow)"
        />

        {/* Inner Shield Bevel Line */}
        <path
          d="M24 5.5C31 5.5 38.5 8.5 38.5 15.5C38.5 27 30 36 24 40.2C18 36 9.5 27 9.5 15.5C9.5 8.5 17 5.5 24 5.5Z"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1.2"
        />

        {/* 2. Stylized House / Gabled Roof of Community (Rukun Tetangga) */}
        <path
          d="M24 11.5L34.5 20.5H30.5V30.5H26.5V23.5H21.5V30.5H17.5V20.5H13.5L24 11.5Z"
          fill="url(#simrt-roof-grad)"
          stroke="rgba(15, 118, 110, 0.4)"
          strokeWidth="0.8"
        />

        {/* 3. Interlocking Civic Unity Hands / Rings (Gotong Royong & RW 02) */}
        <path
          d="M17 33C17 33 20 36 24 36C28 36 31 33 31 33"
          stroke="url(#simrt-gold-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* 4. Digital Node of Trust & Cryptography (Bintang Keamanan) */}
        <path
          d="M24 7.5L25.2 10.2L28 11.4L25.2 12.6L24 15.3L22.8 12.6L20 11.4L22.8 10.2L24 7.5Z"
          fill="url(#simrt-gold-grad)"
        />

        {/* 5. Center Door Portal */}
        <rect x="22" y="24" width="4" height="6.5" rx="1" fill="#0F766E" />
      </svg>

      {/* Optional Integrated Typography */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-tight text-base leading-none ${
                variant === 'light'
                  ? 'text-white'
                  : variant === 'dark'
                  ? 'text-slate-900'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              SIM-RT
            </span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-teal-600 text-white leading-none">
              {config.kodeRt}/{config.kodeRw}
            </span>
          </div>
          <span
            className={`text-[10px] font-semibold tracking-wide leading-tight mt-1 ${
              variant === 'light'
                ? 'text-teal-300'
                : variant === 'dark'
                ? 'text-teal-700'
                : 'text-teal-600 dark:text-teal-400'
            }`}
          >
            {config.namaKelurahan}, {config.namaKecamatan}
          </span>
        </div>
      )}
    </div>
  );
};

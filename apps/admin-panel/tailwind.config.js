/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui-kit/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        teal: {
          700: '#0F766E',
          800: '#115E59',
        },
        slate: {
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        violet: {
          700: '#6D28D9',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Courier', 'monospace'],
      },
    },
  },
  plugins: [],
};

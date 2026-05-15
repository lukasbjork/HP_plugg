/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // KI-inspirerat färgschema
        ki: {
          blue: '#1B3A6B',      // Mörkblå huvudfärg
          'blue-light': '#2A5298',
          'blue-pale': '#EEF2FA',
          gold: '#C9A84C',       // Guldfärg accent
          'gold-light': '#F0E0A0',
          white: '#FFFFFF',
          gray: '#F8F9FB',
          'gray-mid': '#E5E9F0',
          'gray-dark': '#6B7280',
          text: '#1A1A2E',
        },
        section: {
          ORD: '#7C3AED',   // Lila
          LÄS: '#2563EB',   // Blå
          MEK: '#0891B2',   // Cyan
          XYZ: '#059669',   // Grön
          KVA: '#D97706',   // Orange
          NOG: '#DC2626',   // Röd
          DTK: '#7C3AED',   // Lila (samma som ORD)
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'correct-flash': 'correctFlash 0.5s ease-in-out',
        'wrong-flash': 'wrongFlash 0.5s ease-in-out',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'flip': 'flip 0.6s ease-in-out',
      },
      keyframes: {
        correctFlash: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: '#D1FAE5' },
        },
        wrongFlash: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: '#FEE2E2' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        flip: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' },
        },
      },
    },
  },
  plugins: [],
};

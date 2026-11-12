import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fff8f1',
          100: '#ffeedb',
          200: '#fddcb7',
          300: '#fbbd86',
          400: '#f89352',
          DEFAULT: '#f97316', // orange-500
          dark:    '#ea580c', // orange-600
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        surface: {
          base:      '#090a0f',
          card:      '#12141c',
          elevated:  '#181b24',
          overlay:   '#202432',
          highlight: 'rgba(249, 115, 22, 0.12)',
        },
      },
      boxShadow: {
        'ember':   '0 0 25px -4px rgba(249, 115, 22, 0.3)',
        'glow-sm': '0 0 15px rgba(249, 115, 22, 0.2)',
        'glow-md': '0 0 30px rgba(249, 115, 22, 0.25)',
        'glass':   '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 12px rgba(249, 115, 22, 0.45))' },
          '50%': { opacity: '0.8', filter: 'drop-shadow(0 0 4px rgba(249, 115, 22, 0.2))' },
        },
      },
      animation: {
        float: 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;

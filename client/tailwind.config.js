/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        royale: {
          bg: '#0a0a12',
          panel: 'rgba(255,255,255,0.06)',
          gold: '#f4d58d',
          platinum: '#d8dde6',
          // Ludo player palette
          red: '#ff3b5c', blue: '#3b6bff', green: '#19c37d',
          yellow: '#ffc23b', purple: '#9b5bff', orange: '#ff8a3b',
        },
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)',
        neo: '12px 12px 32px #05050a, -8px -8px 24px #14141f',
        'glow-gold': '0 0 24px rgba(244,213,141,0.55)',
      },
      backdropBlur: { xs: '2px' },
      fontFamily: {
        display: ['"Clash Display"', 'Poppins', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        floaty: 'floaty 4s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
};

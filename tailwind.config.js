/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        game: {
          gold: '#e6b31e',
          'gold-faded': 'rgba(230, 179, 30, 0.3)',
          teal: '#7fdbca',
          'teal-faded': 'rgba(127, 219, 202, 0.3)',
          red: '#ff6b6b',
          purple: '#8b5cf6',
          'purple-faded': 'rgba(139, 92, 246, 0.3)',
          pink: '#d946ef',
          'pink-faded': 'rgba(217, 70, 239, 0.3)',
          'bg-dark': '#0a0a0a',
          'bg-light': '#111111',
          white: '#f0f0f0',
        },
        suit: {
          air: '#f0f0f0',
          water: '#8b5cf6',
          fire: '#e6b31e',
          earth: '#d946ef',
        },
      },
      fontFamily: {
        mono: ['"Courier New"', 'monospace'],
      },
      boxShadow: {
        'neon-gold': '0 0 15px rgba(230, 179, 30, 0.4), inset 0 0 15px rgba(230, 179, 30, 0.1)',
        'neon-purple': '0 0 20px rgba(139, 92, 246, 0.3), inset 0 0 20px rgba(139, 92, 246, 0.07)',
        'neon-teal': '0 0 15px rgba(127, 219, 202, 0.6)',
        'neon-pink': '0 0 15px rgba(217, 70, 239, 0.4)',
      },
    },
  },
  plugins: [],
};

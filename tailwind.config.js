/** @type {import('tailwindcss').Config} */
// Paleta e tipografia IDENTICAS as das LPs (Setur Trafego / Setur Unificado),
// pra que o preview do gerador mostre exatamente o que vai pro ar.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'dark-teal': {
          DEFAULT: '#09282B',
          light: '#0F3A3F',
          soft: '#14494E',
        },
        'off-white': '#F8F6F7',
        lime: {
          DEFAULT: '#D7F264',
          dark: '#C0E046',
        },
        'light-green': '#DFEFC5',
        'soft-green': '#EDF5DC',
      },
      fontFamily: {
        serif: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"moret-variable"', '"Moret"', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'lime-glow': '0 12px 40px -8px rgba(215, 242, 100, 0.4)',
        card: '0 8px 30px rgba(9, 40, 43, 0.08)',
        'card-lg': '0 20px 60px rgba(9, 40, 43, 0.12)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}

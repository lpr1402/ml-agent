/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'gold': '#FFE600',
        'gold-light': '#FFF4B3',
        'gold-dark': '#FFC700',
        'gold-darker': '#FFB300',
        'black-soft': '#0A0A0A',
        'black-medium': '#111111',
        'black-light': '#1A1A1A',
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(135deg, #FFE600 0%, #FFC700 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0A0A0A 0%, #111111 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(26, 26, 26, 0.8) 0%, rgba(17, 17, 17, 0.6) 100%)',
      },
      animation: {
        'pulse-gold': 'pulse-gold 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 3s linear infinite',
      },
      keyframes: {
        'pulse-gold': {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(255, 230, 0, 0.3)',
          },
          '50%': {
            boxShadow: '0 0 30px rgba(255, 230, 0, 0.5)',
          },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: { brand: '#6557e8', ink: '#20242c' },
      boxShadow: { soft: '0 8px 30px rgba(30,33,48,.08)' },
    },
  },
  plugins: [],
};

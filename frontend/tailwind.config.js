/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif']
      },
      boxShadow: {
        card: '0 20px 45px -24px rgba(20, 43, 67, 0.36)'
      }
    }
  },
  darkMode: 'class',
  plugins: []
};

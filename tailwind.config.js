/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // System stack: works offline, no external font host (CSP: font-src 'self')
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fdf3ec',
          100: '#fae3d3',
          500: '#d05a1e',
          600: '#c2410c',
          700: '#9a3412',
        },
        surface: '#fcfcfb',
        page: '#f9f9f7',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,11,11,0.04), 0 2px 8px rgba(11,11,11,0.04)',
      },
    },
  },
  plugins: [],
}

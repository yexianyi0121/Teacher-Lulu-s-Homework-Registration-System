/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand)',
        'brand-soft': 'var(--brand-soft)',
      },
    },
  },
  plugins: [],
};

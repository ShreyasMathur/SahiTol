import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bfd3fe',
          300: '#93b4fd',
          400: '#608bfa',
          500: '#3b65f6',
          600: '#2546eb',
          700: '#1d35d8',
          800: '#1e2daf',
          900: '#1e2c8a',
          950: '#161d54',
        },
        // Reserved for compliance/workflow state; always paired with a text label.
        status: {
          pass: '#15803d',
          fail: '#b91c1c',
          pending: '#b45309',
          info: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [forms],
};

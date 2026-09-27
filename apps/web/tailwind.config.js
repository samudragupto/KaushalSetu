/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F7F8FA',
        surface: '#FFFFFF',
        line: '#E6E8EC',
        grid: '#EEF0F3',
        ink: '#111827',
        muted: '#6B7280',
        navy: { DEFAULT: '#0F172A', 800: '#1E293B', 700: '#334155' },
        primary: { DEFAULT: '#0F766E', 50: '#EFF7F6', 100: '#D6ECEA', 200: '#A9D5D1', 600: '#0D6B64', 700: '#0B5E58' },
        saffron: { DEFAULT: '#F59E0B', 50: '#FEF6E7' },
        success: { DEFAULT: '#16A34A', 50: '#ECF8F0' },
        warning: { DEFAULT: '#D97706', 50: '#FDF4E6' },
        danger: { DEFAULT: '#DC2626', 50: '#FDEDED' },
      },
      fontFamily: {
        sans: ['"Public Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '8px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04)',
        lift: '0 4px 16px rgba(15,23,42,.08)',
      },
    },
  },
  plugins: [],
};

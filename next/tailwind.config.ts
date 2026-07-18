import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/views/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      /* Plancher lisibilité multi-écrans : xs ≥ 13px, sm reste 14px */
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.4' }],
        sm: ['0.9375rem', { lineHeight: '1.45' }],
        base: ['1rem', { lineHeight: '1.55' }],
        caption: ['0.8125rem', { lineHeight: '1.4' }],
        ui: ['0.9375rem', { lineHeight: '1.45' }],
        body: ['1rem', { lineHeight: '1.55' }],
      },
      colors: {
        accent: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          muted: 'rgba(99,102,241,0.12)',
          dark: '#818cf8',
        },
      },
    },
  },
  plugins: [],
}
export default config

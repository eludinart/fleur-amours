import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
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

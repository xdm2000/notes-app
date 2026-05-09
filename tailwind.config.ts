import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        note: {
          bg: 'var(--note-bg)',
          border: 'var(--note-border)',
        }
      }
    },
  },
  plugins: [],
}

export default config

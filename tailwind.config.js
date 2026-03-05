/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        base: 'var(--color-base)',
        surface: 'var(--color-surface)',
        elevated: 'var(--color-elevated)',
        'th-hover': 'var(--color-hover)',
        border: {
          DEFAULT: 'var(--color-border)',
          hover: 'var(--color-border-hover)',
        },
        text: {
          DEFAULT: 'var(--color-text)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          dark: 'var(--color-text-dark)',
          darker: 'var(--color-text-darker)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          blue: '#3b82f6',
          green: '#22c55e',
          orange: '#f97316',
          pink: '#ec4899',
          red: '#FF2D2D',
        },
      },
      fontFamily: {
        sans: ['Space Mono', 'Courier New', 'monospace'],
        mono: ['Space Mono', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'tracklib': '0 8px 32px var(--color-shadow)',
        'tracklib-sm': '0 4px 16px var(--color-shadow)',
        'nothing': '0 0 0 1px rgba(255,255,255,0.06)',
        'nothing-red': '0 0 20px rgba(255,45,45,0.15)',
      }
    }
  },
  plugins: []
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        limewash: '#EDE6D6',
        ink: '#1C1C1C',
        terracotta: {
          DEFAULT: '#A85A38',
          hover: '#8F4A2C'
        },
        verified: '#3F6E64',
        agent: {
          DEFAULT: '#1F2937',
          light: '#2B3648'
        },
        line: '#DDD4C2'
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 8px 24px rgba(0, 0, 0, 0.05)'
      },
      maxWidth: {
        hunter: '28rem'
      }
    }
  },
  plugins: []
}

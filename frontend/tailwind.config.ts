import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        nebula: '#4f46e5',
      },
    },
  },
  plugins: [],
};

export default config;

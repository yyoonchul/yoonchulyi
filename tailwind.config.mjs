/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        bg: '#F4F4F0',
        text: '#191919',
        sub: '#8C8C8C',
        accent: '#EA580C',
      },
      fontFamily: {
        serif: ['Newsreader', 'serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

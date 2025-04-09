/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          100: 'oklch(100% 0 0)',
          200: 'oklch(98% 0.01 240)',
          300: 'oklch(95% 0.02 240)',
          content: 'oklch(23% 0.05 260)',
        },
        primary: {
          DEFAULT: 'oklch(23% 0.05 260)',
          content: 'oklch(100% 0 0)',
        },
        secondary: {
          DEFAULT: 'oklch(45% 0.1 250)',
          content: 'oklch(100% 0 0)',
        },
        accent: {
          DEFAULT: 'oklch(85% 0.2 85)',
          content: 'oklch(23% 0.05 260)',
        },
        neutral: {
          DEFAULT: 'oklch(20% 0.05 260)',
          content: 'oklch(100% 0 0)',
        },
      },
      borderRadius: {
        box: 'var(--rounded-box)',
        btn: 'var(--rounded-btn)',
        badge: 'var(--rounded-badge)',
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light"],
    base: true,
    styled: true,
    utils: true,
    rtl: false,
    prefix: "",
    logs: true,
  },
} 
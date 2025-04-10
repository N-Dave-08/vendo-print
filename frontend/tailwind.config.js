/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        mytheme: {
          "primary": "#0A0F2C",
          "secondary": "#1A2B88", 
          "accent": "#3D4DDB",
          "neutral": "#E6E8F4",
          "base-100": "#FFFFFF",
        }
      },
      "acid",
      ],
    base: true,
    styled: true,
    utils: true,
    rtl: false,
    prefix: "",
    logs: true,
  },
} 
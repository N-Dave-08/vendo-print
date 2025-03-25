/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", 
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#31304D',
          dark: '#262541',
          light: '#4A4971',
          50: '#EEEEFF'
        }
      }
    },
  },
  plugins: [],
}

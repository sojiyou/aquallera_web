/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#065A82',
          dark: '#1B3B6F',
          darkest: '#21295C',
        },
        secondary: {
          DEFAULT: '#1C7293',
        },
        surface: '#9EB3C2',
        appBg: '#FFFCF2',
      },
    },
  },
  plugins: [],
}

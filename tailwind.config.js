/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          dark: '#1d4ed8',
        },
      },
    },
  },
  plugins: [],
}

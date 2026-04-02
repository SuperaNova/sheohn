/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0f172a",
        primary: "#2d4a33",
        tertiary: "#b86a49",
      },
      fontFamily: {
        serifDisplay: ["Playfair Display", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        ambient: "0 24px 40px rgba(28, 28, 25, 0.06)",
      },
    },
  },
};

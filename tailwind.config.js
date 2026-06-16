/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Claude.ai-ish warm neutral palette
        canvas: "#262624",
        surface: "#30302e",
        elevated: "#3a3a37",
        border: "#46443f",
        ink: "#f5f4ef",
        muted: "#b4b2a8",
        faint: "#85837a",
        accent: "#d97757", // Claude clay/orange
        accentSoft: "#c2613f",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        serif: ["Georgia", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
};

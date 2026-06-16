/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Claude.ai light, warm-neutral palette
        canvas: "#FBF8F2", // main chat background (cream)
        surface: "#FFFFFF", // cards, composer, banner, chart
        elevated: "#F1ECE3", // hover, user bubble, chips
        sand: "#EFEAE0", // sidebar background (beige)
        border: "#E7E1D6",
        ink: "#29251F", // primary text
        muted: "#6E6A62", // secondary text
        faint: "#9C978C", // tertiary text
        accent: "#CF6B33", // burnt orange
        accentSoft: "#B85B28", // hover
        peach: "#FBE8DC", // light-orange icon tiles
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        serif: ["Georgia", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
};

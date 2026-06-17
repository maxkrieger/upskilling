/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Claude.ai light, warm-neutral palette
        canvas: "#FCFBF8", // main chat background (near-white warm)
        surface: "#FFFFFF", // cards, composer, banner, chart
        elevated: "#F2EFE9", // hover, user bubble, chips
        sand: "#F5F3EE", // sidebar background (light warm)
        border: "#E9E4DA",
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
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "rise-in": "rise-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

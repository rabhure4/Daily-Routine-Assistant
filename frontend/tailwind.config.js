/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // All accent usage goes through var(--accent) so swapping
        // the CSS variable in index.css is the only change needed per project.
        accent: "var(--accent)",
        surface: "#1a1a1a",
        border: "#2a2a2a",
        base: "#0f0f0f",
      },
      animation: {
        pulse: "pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

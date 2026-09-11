/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          white: "#F9F9F9",
          blue: {
            DEFAULT: "#004E72",
            hover: "#003852",
            light: "#EBF3F7",
            border: "#B3D1E0",
          },
          navy: {
            DEFAULT: "#092634",
            light: "#113A4F",
            surface: "#0D2E3F",
            border: "#18455C",
          },
          orange: {
            DEFAULT: "#FF6E42",
            hover: "#E8592E",
            light: "#FFF1ED",
            border: "#FFD2C4",
          },
        },
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#F9F9F9",
          muted: "#F1F5F9",
          card: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(9, 38, 52, 0.05)",
        card: "0 1px 3px 0 rgba(9, 38, 52, 0.08), 0 1px 2px -1px rgba(9, 38, 52, 0.08)",
        dropdown: "0 4px 12px 0 rgba(9, 38, 52, 0.12)",
      },
    },
  },
  plugins: [],
};

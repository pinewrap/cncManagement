import type { Config } from "tailwindcss";

// Palette is intentionally left as placeholders — swap these for the
// client's actual brand colors once we have their logo/brand guide,
// same way the Pinewrap invoice tool picked up real brand colors.
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#16243F", // placeholder navy
          accent: "#FFD400", // placeholder yellow
        },
      },
    },
  },
  plugins: [],
};

export default config;

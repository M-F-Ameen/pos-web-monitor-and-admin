import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tager Branding Colors
        primary: {
          50: "#f0f4fb",
          100: "#d9e4f5",
          200: "#b3c8eb",
          300: "#8dade1",
          400: "#6791d7",
          500: "#4175cd",
          600: "#2b5ab0",
          700: "#1f3f8a",
          800: "#152464",
          900: "#001F5C", // Main dark blue
        },
        accent: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#2AB92A", // Main accent green
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#145231",
        },
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#00C853", // Bright green
          600: "#009d3a",
          700: "#007e2f",
          800: "#005f24",
          900: "#00441a",
        },
        negative: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#E74C3C", // Red for negative
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
        },
        neutral: {
          50: "#fafafa",
          100: "#f5f5f5", // Secondary background
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
        },
        text: {
          primary: "#1A1A1A",
          secondary: "#666666",
          light: "#999999",
        },
        border: {
          DEFAULT: "#E8E8E8",
          light: "#F5F5F5",
        },
      },
      fontFamily: {
        cairo: ["var(--font-cairo)", "sans-serif"],
        sans: ["var(--font-cairo)", "system-ui", "sans-serif"],
      },
      direction: ["rtl", "ltr"],
      spacing: {
        "safe-inset-t": "max(var(--safe-area-inset-top, 0px), 1rem)",
        "safe-inset-r": "max(var(--safe-area-inset-right, 0px), 1rem)",
        "safe-inset-b": "max(var(--safe-area-inset-bottom, 0px), 1rem)",
        "safe-inset-l": "max(var(--safe-area-inset-left, 0px), 1rem)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 2s infinite",
        slideDown: "slideDown 0.2s ease-out",
        slideUp: "slideUp 0.2s ease-out",
      },
      screens: {
        xs: "480px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
    },
  },
  plugins: [
    // RTL plugin for Tailwind
    require("tailwindcss-rtl"),
  ],
  future: {
    hoverOnlyWhenSupported: true,
  },
};

export default config;

/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        chovia: {
          green: "#235347",
          primary: "#235347",
          deep: "#0D2621",
          secondary: "#0D2621",
          gold: "#D4AF37",
          background: "#F5F7F6",
          surface: "#F5F7F6",
          card: "#FFFFFF",
          muted: "#52665F",
          subtle: "#64786E",
          border: "#E2EBE6",
          dotInactive: "#D2DDD8",
          neon: "#0AFF70",
          success: "#10B981",
          warning: "#F59E0B",
          error: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["Manrope-Regular"],
        manrope: ["Manrope-Regular"],
        "manrope-medium": ["Manrope-Medium"],
        "manrope-semibold": ["Manrope-SemiBold"],
        "manrope-bold": ["Manrope-Bold"],
      },
      borderRadius: {
        card: "16px",
        sheet: "32px",
      },
    },
  },
  plugins: [],
};

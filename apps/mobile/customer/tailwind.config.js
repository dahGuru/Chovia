/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        chovia: {
          green: "#235347",
          deep: "#0D2621",
          gold: "#D4AF37",
          background: "#F5F7F6",
        },
      },
      fontFamily: { sans: ["Manrope"] },
    },
  },
  plugins: [],
};

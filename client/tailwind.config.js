/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        foreground: "#0F172A",
        secondary: "#F8FAFC",
        primary: {
          DEFAULT: "#2563EB",
          dark: "#1D4ED8",
        },
        accent: {
          DEFAULT: "#7C3AED",
          dark: "#6D28D9",
        },
        card: "#FFFFFF",
        border: "#E2E8F0",
        text: {
          primary: "#0F172A",
          secondary: "#334155",
        },
        success: "#22C55E",
        error: "#EF4444",
        warning: "#F59E0B",
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)' },
          '50%': { boxShadow: '0 0 16px rgba(59, 130, 246, 0.8)' },
        },
        bounceDrop: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '60%': { transform: 'translateY(5px)', opacity: '1' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
      animation: {
        'glow-slow': 'glow 2.5s ease-in-out infinite',
        'bounce-drop': 'bounceDrop 0.8s ease',
      }
    },
  },
  plugins: [],
};


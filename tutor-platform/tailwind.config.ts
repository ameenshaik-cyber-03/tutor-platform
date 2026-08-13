import type { Config } from "tailwindcss";

// Design tokens — playful/energetic direction (Duolingo-adjacent), chosen to
// fit an ed-tech product aimed at motivating students through visible
// progress. Deliberately avoids the generic AI-default looks (warm cream +
// terracotta serif, or near-black + acid accent) since the brief pinned down
// a specific, different direction.
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FFFFFF",       // bright white — crisp app-like background, not warm/muted
        ink: "#3C4C56",         // warm charcoal-blue, not pure black — friendlier than harsh text
        primary: {
          DEFAULT: "#3CB53A",   // brand green — CTAs, links, active states
          light: "#6FDD5F",
          dark: "#2E9A2C",      // used as the "pressed" bottom-edge shade on 3D buttons
        },
        secondary: {
          DEFAULT: "#1CB0F6",   // sky blue — info accents, secondary actions
          light: "#5FCBFA",
          dark: "#0D8FCB",
        },
        success: {
          DEFAULT: "#58CC02",   // mastered / correct-answer green — distinct from primary
          light: "#8EE24A",
        },
        warn: {
          DEFAULT: "#FFC800",   // needs-practice / streak — warm, not punishing
          light: "#FFDD57",
        },
        danger: "#FF4B4B",      // wrong / destructive actions only — used sparingly
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],  // Baloo 2 — bold, rounded, playful
        body: ["var(--font-body)", "sans-serif"],          // Nunito — friendly, highly legible
        mono: ["var(--font-mono)", "monospace"],           // IBM Plex Mono — code/DSA problems
      },
      borderRadius: {
        card: "1.25rem",        // chunkier rounding than a typical SaaS app — part of the signature
      },
      boxShadow: {
        // The signature element: a solid-color "pressed button" shadow
        // instead of a soft drop shadow — the defining Duolingo-style cue.
        press: "0 4px 0 0 var(--tw-shadow-color)",
      },
    },
  },
  plugins: [],
};

export default config;

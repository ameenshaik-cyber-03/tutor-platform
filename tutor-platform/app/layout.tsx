import type { Metadata } from "next";
import { Baloo_2, Nunito, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Display face: Baloo 2 — bold, rounded, high-personality. This is the
// signature type choice for the playful direction; used for headings and
// buttons, never body copy, so it stays high-impact rather than noisy.
const baloo2 = Baloo_2({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

// Body face: Nunito — rounded terminals that echo the display face without
// competing with it, but far more legible at small sizes for lesson text.
const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600", "700"],
});

// Utility/mono face: for code, data, timers — deliberately NOT rounded,
// so DSA/technical content reads as precise against the playful chrome.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Clario — Learn it properly, not just once",
  description:
    "An adaptive tutor that finds exactly what you're missing, plus interview and placement prep.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${baloo2.variable} ${nunito.variable} ${plexMono.variable}`}>
      <body className="font-body bg-paper text-ink antialiased">
        {children}
      </body>
    </html>
  );
}

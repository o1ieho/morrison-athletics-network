import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-barlow", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "MAT Athletics",
    template: "%s · MAT Athletics",
  },
  description: "Schedules, live scores, box scores and stats for Morrison Academy Taipei Broncos basketball.",
  icons: { icon: "/brand/broncos-head-cropped.png" },
};

export const viewport: Viewport = {
  themeColor: "#16271f",
};

// The public site and the operator console have different chrome, so each
// route group ((site) and operator) supplies its own header.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${barlow.variable}`}>
      <body>{children}</body>
    </html>
  );
}

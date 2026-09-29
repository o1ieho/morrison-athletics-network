import type { Metadata, Viewport } from "next";
import { Anton, Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-body", display: "swap" });
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-heading", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "MAT Athletics",
    template: "%s · MAT Athletics",
  },
  description: "Schedules, live scores, box scores and stats for Morrison Academy Taipei Broncos basketball.",
  icons: { icon: "/brand/broncos-head-cropped.png" },
};

export const viewport: Viewport = {
  themeColor: "#455a4d",
};

// The public site and the operator console have different chrome, so each
// route group ((site) and operator) supplies its own header.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${roboto.variable} ${anton.variable}`}>
      <body>{children}</body>
    </html>
  );
}

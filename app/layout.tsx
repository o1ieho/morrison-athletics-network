import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Activity, CalendarDays, Newspaper, Shield, Trophy, UsersRound } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Morrison Academy Taipei Athletics",
    template: "%s | Morrison Academy Taipei Athletics",
  },
  description:
    "The official digital home for Morrison Academy Taipei Athletics schedules, teams, live games, athletes, announcements, and media.",
};

const nav = [
  { href: "/", label: "Home" },
  { href: "/teams", label: "Teams" },
  { href: "/schedule", label: "Schedule" },
  { href: "/live", label: "Live Games" },
  { href: "/announcements", label: "Announcements" },
  { href: "/athletes", label: "Athletes" },
  { href: "/media", label: "Media" },
  { href: "/about", label: "About Athletics" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand-lockup" aria-label="Morrison Academy Taipei Athletics home">
            <span className="brand-mark">
              <Image src="/brand/broncos-head-cropped.png" alt="" width={34} height={38} priority />
            </span>
            <span>
              <strong>Morrison Academy Taipei Athletics</strong>
              <small>School Sports Network</small>
            </span>
          </Link>
          <nav className="primary-nav" aria-label="Primary navigation">
            {nav.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link href="/operator/live" className="icon-link" aria-label="Live operator">
              <Activity size={18} />
            </Link>
            <Link href="/admin" className="icon-link" aria-label="Admin">
              <Shield size={18} />
            </Link>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="footer-ribbon" aria-hidden="true" />
          <div className="footer-grid">
            <span><Trophy size={16} /> All-sport hub</span>
            <span><CalendarDays size={16} /> Season schedule</span>
            <span><UsersRound size={16} /> Athlete profiles</span>
            <span><Newspaper size={16} /> Announcements</span>
          </div>
          <div className="footer-lockup">
            <Image src="/brand/morrison-m-cropped.png" alt="Morrison Academy Taipei Athletics" width={150} height={136} />
            <strong>Morrison Academy Taipei Athletics</strong>
            <p>© 2026 Morrison Academy Taipei Athletics</p>
          </div>
        </footer>
      </body>
    </html>
  );
}

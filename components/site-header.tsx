"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useLiveGames } from "./live-games";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/teams", label: "Teams" },
  { href: "/news", label: "News" },
  { href: "/media", label: "Media" },
];

/** How long the mobile menu takes to close (matches .mobile-nav.closing in the CSS). */
const CLOSE_MS = 150;

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const live = useLiveGames();
  const [open, setOpen] = useState(false);
  // Keeps the menu on screen while its close animation plays.
  const [closing, setClosing] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setClosing(false), CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  // The page behind the open menu doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const toggle = () => {
    if (open) setClosing(true);
    setOpen(!open);
  };

  // While a game is live, the menu leads with it: on phones the menu is where people look.
  const liveGame = live[0];
  const liveLink = liveGame && (
    <Link href={`/games/${liveGame.id}`} className="nav-live" aria-current={pathname === `/games/${liveGame.id}` ? "page" : undefined}>
      <span className="live-tag">Live</span>
      <span className="nav-live-text">Broncos vs {liveGame.opponent.shortName}</span>
    </Link>
  );
  const links = NAV.map((item) => (
    <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
      {item.label}
    </Link>
  ));

  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand" aria-label="MAT Athletics Basketball home">
          <Image className="brand-mark" src="/brand/broncos-head-cropped.png" alt="" width={60} height={66} priority />
          <span className="brand-text">
            <strong>MAT Athletics</strong>
            <span>Basketball</span>
          </span>
        </Link>
        <nav className="nav" aria-label="Main">
          {liveLink}
          {links}
        </nav>
        <button
          type="button"
          className="menu-button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={toggle}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {(open || closing) && (
        <nav id="mobile-nav" className={`mobile-nav ${open ? "" : "closing"}`} aria-label="Main">
          {liveLink}
          {links}
        </nav>
      )}
    </header>
  );
}

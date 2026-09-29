"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/games", label: "Games" },
  { href: "/admin/roster", label: "Rosters" },
  { href: "/admin/opponents", label: "Opponents" },
  { href: "/admin/news", label: "News" },
  { href: "/operator", label: "Operator" },
  { href: "/", label: "View site" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="nav" style={{ display: "flex", overflowX: "auto" }} aria-label="Admin">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} aria-current={pathname.startsWith(link.href) && link.href !== "/" ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

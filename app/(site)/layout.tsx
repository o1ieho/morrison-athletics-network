import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { isDemoMode } from "@/lib/config";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {isDemoMode && (
        <div className="demo-banner" role="status">
          <strong>Demo mode:</strong> sample games and stats, not real results.
        </div>
      )}
      <SiteHeader />
      {children}
      <footer className="site-footer">
        <div className="container">
          <span>© {new Date().getFullYear()} Morrison Academy Taipei Athletics</span>
          <nav aria-label="Footer">
            <Link href="/about">About</Link>
            <Link href="/operator">Staff sign-in</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

import Image from "next/image";
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
      <div className="footer-mark" aria-hidden="true">
        <Image src="/brand/morrison-m-cropped.png" alt="" width={170} height={154} />
      </div>
      <footer className="site-footer">
        <div className="container">
          {/* Text stand-in for the Morrison Academy Taipei logo until the image file is added. */}
          <div className="school-lockup" aria-label="Morrison Academy Taipei">
            <span className="school-name">
              <strong>Morrison Academy</strong>
              <span>Taipei</span>
            </span>
            <span className="school-motto">
              Journeying beyond
              <br />
              knowledge to wisdom
            </span>
          </div>
          <nav aria-label="Footer">
            <Link href="/about">About</Link>
            <Link href="/operator">Staff sign-in</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

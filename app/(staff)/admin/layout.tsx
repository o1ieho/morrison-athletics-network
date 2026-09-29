import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireStaff } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff("admin", "/admin");
  return (
    <>
      {isDemoMode && (
        <div className="demo-banner" role="status">
          <strong>Demo mode:</strong> you can look around, but saving is off until Supabase is connected.
        </div>
      )}
      <header className="site-header">
        <div className="container">
          <Link href="/admin" className="brand">
            <span className="brand-text">
              <strong>MAT Admin</strong>
              <span>{user.email}</span>
            </span>
          </Link>
          <AdminNav />
        </div>
      </header>
      <main className="page">
        <div className="container">{children}</div>
      </main>
    </>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getStaffUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";

export const metadata: Metadata = { title: "Staff sign-in" };

type Props = { searchParams: Promise<{ next?: string; denied?: string }> };

function safeNext(next: string | undefined) {
  // Only allow same-site paths, never an absolute URL.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/operator";
}

export default async function LoginPage({ searchParams }: Props) {
  const { next, denied } = await searchParams;
  const destination = safeNext(next);
  if (isDemoMode) redirect(destination);

  const user = await getStaffUser();
  if (user && !denied) redirect(destination);

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 440 }}>
        <div className="card card-pad stack">
          <div className="page-head" style={{ marginBottom: 0 }}>
            <p className="eyebrow">Staff</p>
            <h1>Sign in</h1>
            <p className="muted">For stat operators and athletics staff. Accounts are created by an admin.</p>
          </div>
          {denied && (
            <div className="notice error">
              {user ? `${user.email} doesn't have access to that page. Ask an admin to add the right role.` : "You don't have access to that page."}
            </div>
          )}
          <LoginForm next={destination} />
        </div>
      </div>
    </main>
  );
}

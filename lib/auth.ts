import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/config";
import { createSessionClient } from "@/lib/supabase/server";

export type Role = "admin" | "stat_operator";

export type StaffUser = {
  id: string;
  email: string;
  roles: Role[];
  isAdmin: boolean;
  canOperate: boolean;
};

const DEMO_USER: StaffUser = { id: "demo", email: "demo mode", roles: ["admin"], isAdmin: true, canOperate: true };

/** The signed-in staff member, or null. Authoritative: verifies the session with Supabase. */
export async function getStaffUser(): Promise<StaffUser | null> {
  if (isDemoMode) return DEMO_USER;

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
  const roles = (roleRows ?? []).map((row) => row.role as Role);
  const isAdmin = roles.includes("admin");
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    roles,
    isAdmin,
    canOperate: isAdmin || roles.includes("stat_operator"),
  };
}

/** Redirects to /login unless the visitor holds one of the required roles. */
export async function requireStaff(need: "operate" | "admin", returnTo: string): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  const allowed = need === "admin" ? user.isAdmin : user.canOperate;
  if (!allowed) redirect(`/login?next=${encodeURIComponent(returnTo)}&denied=1`);
  return user;
}

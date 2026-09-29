import { AdminSectionPage } from "@/components/admin";

export default function AdminStandingsPage() {
  return <AdminSectionPage title="Manage standings" description="Admin-managed standings records and manual overrides for v1." fields={["Team", "Wins", "Losses", "Ties", "Notes"]} />;
}

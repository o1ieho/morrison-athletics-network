import { AdminSectionPage } from "@/components/admin";

export default function AdminCoachesPage() {
  return <AdminSectionPage title="Manage coaches" description="Team-linked coach profiles for public team pages." fields={["Full name", "Title", "Team", "Bio", "Photo URL"]} />;
}

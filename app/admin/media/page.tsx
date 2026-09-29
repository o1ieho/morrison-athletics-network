import { AdminSectionPage } from "@/components/admin";

export default function AdminMediaPage() {
  return <AdminSectionPage title="Manage media" description="Highlights, galleries, livestream embeds, and featured assets." fields={["Title", "Type", "URL", "Caption", "Association"]} />;
}

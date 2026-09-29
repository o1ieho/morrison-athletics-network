import { AnnouncementCard } from "@/components/cards";
import { getAnnouncements } from "@/lib/supabase-queries";

export default async function AnnouncementsPage() {
  const announcements = await getAnnouncements();
  return (
    <main className="page section">
      <p className="eyebrow">Announcements and News</p>
      <h1>Department updates and feature stories</h1>
      <div className="grid three">
        {announcements.map((announcement) => <AnnouncementCard announcement={announcement} key={announcement.id} />)}
      </div>
    </main>
  );
}

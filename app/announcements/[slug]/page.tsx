import { notFound } from "next/navigation";
import { getAnnouncementBySlug } from "@/lib/supabase-queries";
import { formatDate } from "@/lib/utils";

export default async function AnnouncementPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const announcement = await getAnnouncementBySlug(slug);
  if (!announcement) notFound();

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">{announcement.category.replace("-", " ")} · {formatDate(announcement.publishedAt)}</p>
          <h1>{announcement.title}</h1>
          <p>{announcement.summary}</p>
        </div>
      </section>
      <article className="section">
        <p>{announcement.body}</p>
      </article>
    </main>
  );
}

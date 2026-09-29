import type { Metadata } from "next";
import Link from "next/link";
import { getData } from "@/lib/data";
import { formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "News" };

export default async function NewsPage() {
  const announcements = await (await getData()).getAnnouncements();
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 820 }}>
        <div className="page-head">
          <p className="eyebrow">Athletics department</p>
          <h1>News & announcements</h1>
        </div>
        <div className="card game-list">
          {announcements.map((item) => (
            <Link key={item.id} href={`/news/${item.slug}`} className="game-row" style={{ gridTemplateColumns: "1fr" }}>
              <span className="game-main">
                <span>
                  {item.pinned ? "Pinned · " : ""}
                  {item.category.replace("-", " ")}
                  {item.publishedAt ? ` · ${formatDay(item.publishedAt)}` : ""}
                </span>
                <strong style={{ whiteSpace: "normal" }}>{item.title}</strong>
                {item.summary && <span>{item.summary}</span>}
              </span>
            </Link>
          ))}
          {!announcements.length && <p className="empty">No announcements right now.</p>}
        </div>
      </div>
    </main>
  );
}

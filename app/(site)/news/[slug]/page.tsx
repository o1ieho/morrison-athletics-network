import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getData } from "@/lib/data";
import { formatDay } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

async function find(slug: string) {
  return (await (await getData()).getAnnouncements()).find((item) => item.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await find((await params).slug);
  return { title: item?.title ?? "News" };
}

export default async function NewsItemPage({ params }: Props) {
  const item = await find((await params).slug);
  if (!item) notFound();
  return (
    <main className="page">
      <article className="container stack" style={{ maxWidth: 720 }}>
        <Link href="/news" className="muted small">
          ← All news
        </Link>
        <p className="eyebrow">
          {item.category.replace("-", " ")}
          {item.publishedAt ? ` · ${formatDay(item.publishedAt)}` : ""}
        </p>
        <h1>{item.title}</h1>
        {item.summary && <p className="muted" style={{ fontSize: "1.1rem" }}>{item.summary}</p>}
        <div className="stack" style={{ gap: 12 }}>
          {item.body.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </article>
    </main>
  );
}

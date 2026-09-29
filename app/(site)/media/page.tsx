import type { Metadata } from "next";
import { MediaGallery } from "@/components/media-gallery";
import { getData } from "@/lib/data";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage() {
  const media = await (await getData()).getMedia();
  return (
    <main className="page">
      <div className="container">
        <div className="page-head">
          <p className="eyebrow">Broncos basketball</p>
          <h1>Media</h1>
          <p className="muted">Photos and highlights from the season.</p>
        </div>
        <MediaGallery items={media} />
      </div>
    </main>
  );
}

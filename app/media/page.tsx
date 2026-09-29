import { getMediaAssets } from "@/lib/supabase-queries";

export default async function MediaPage() {
  const mediaAssets = await getMediaAssets();
  return (
    <main className="page section">
      <p className="eyebrow">Media</p>
      <h1>Highlights, galleries, and embeds</h1>
      <div className="grid three">
        {mediaAssets.map((asset) => (
          <article className="feature-card" key={asset.id}>
            <p className="eyebrow">{asset.featured ? "Featured · " : ""}{asset.type}</p>
            <h3>{asset.title}</h3>
            <p>{asset.caption}</p>
            {asset.type === "video" ? (
              <iframe title={asset.title} src={asset.url} style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }} allowFullScreen />
            ) : (
              <img alt="" src={asset.url} style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }} />
            )}
          </article>
        ))}
      </div>
    </main>
  );
}

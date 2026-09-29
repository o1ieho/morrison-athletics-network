import type { Metadata } from "next";
import { Play } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { MediaUploader } from "@/components/admin/media-uploader";
import { getAdminData } from "@/lib/admin-data";
import { isDemoMode } from "@/lib/config";
import { formatDay } from "@/lib/format";
import { deleteMedia } from "../actions";

export const metadata: Metadata = { title: "Media · Admin" };

export default async function AdminMedia() {
  const data = await getAdminData();
  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <p className="eyebrow">Admin</p>
        <h1>Media</h1>
        <p className="muted">The newest six show on the home page. Everything shows on the Media page.</p>
      </div>

      <section className="card card-pad stack">
        <h2>Add photos or a video</h2>
        {isDemoMode ? <div className="notice">Uploading is off in demo mode.</div> : <MediaUploader teams={data.teams} />}
      </section>

      <section>
        <div className="section-head">
          <h2>Library</h2>
          <span className="muted small">{data.media.length} items</span>
        </div>
        {data.media.length ? (
          <div className="gallery">
            {data.media.map((item) => (
              <figure key={item.id} className="admin-media">
                <div className="media-tile">
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized thumbnail */}
                  <img src={item.thumbnailUrl ?? item.url} alt="" loading="lazy" />
                  {item.kind === "video" && (
                    <span className="media-play" aria-hidden="true">
                      <Play size={24} fill="currentColor" />
                    </span>
                  )}
                </div>
                <figcaption>
                  <span className="small">{item.title || <span className="muted">No caption</span>}</span>
                  <span className="muted small">{formatDay(item.createdAt)}</span>
                  <form action={deleteMedia}>
                    <input type="hidden" name="id" value={item.id} />
                    <ConfirmButton className="button small secondary" message="Delete this from the site? This can't be undone.">
                      Delete
                    </ConfirmButton>
                  </form>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="card empty">Nothing uploaded yet.</div>
        )}
      </section>
    </div>
  );
}

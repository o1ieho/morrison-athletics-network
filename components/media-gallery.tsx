"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { formatDay } from "@/lib/format";
import { youtubeEmbed, youtubeId } from "@/lib/media";
import type { MediaItem } from "@/lib/types";

/** Grid of photos and videos; tapping one opens it full screen. */
export function MediaGallery({ items }: { items: MediaItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  // Open the item named in the URL (links from the home page use #id).
  useEffect(() => {
    const id = window.location.hash.slice(1);
    const index = items.findIndex((item) => item.id === id);
    if (index >= 0) setOpen(index);
  }, [items]);

  const close = useCallback(() => {
    setOpen(null);
    if (window.location.hash) history.replaceState(null, "", window.location.pathname);
  }, []);

  const step = useCallback(
    (delta: number) => setOpen((current) => (current === null ? null : (current + delta + items.length) % items.length)),
    [items.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [close, open, step]);

  if (!items.length) {
    return <div className="panel"><p className="panel-empty">Photos and highlights from the season will appear here.</p></div>;
  }

  const current = open === null ? null : items[open];
  const videoId = current?.kind === "video" ? youtubeId(current.url) : null;

  return (
    <>
      <div className="gallery">
        {items.map((item, index) => (
          <button key={item.id} id={item.id} type="button" className="media-tile" onClick={() => setOpen(index)} aria-label={item.title || (item.kind === "video" ? "Play video" : "Open photo")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails are pre-sized in Storage */}
            <img src={item.thumbnailUrl ?? item.url} alt="" loading="lazy" />
            {item.kind === "video" && (
              <span className="media-play" aria-hidden="true">
                <Play size={28} fill="currentColor" />
              </span>
            )}
          </button>
        ))}
      </div>

      {current && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={current.title || "Media"} onClick={close}>
          <button type="button" className="lightbox-close" onClick={close} aria-label="Close">
            <X size={26} />
          </button>
          {items.length > 1 && (
            <>
              <button type="button" className="lightbox-nav prev" onClick={(event) => (event.stopPropagation(), step(-1))} aria-label="Previous">
                <ChevronLeft size={32} />
              </button>
              <button type="button" className="lightbox-nav next" onClick={(event) => (event.stopPropagation(), step(1))} aria-label="Next">
                <ChevronRight size={32} />
              </button>
            </>
          )}
          <figure className="lightbox-figure" onClick={(event) => event.stopPropagation()}>
            {videoId ? (
              <iframe
                src={youtubeEmbed(videoId)}
                title={current.title || "Video"}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- full-size photo from Storage
              <img src={current.url} alt={current.title} />
            )}
            <figcaption>
              {current.title && <strong>{current.title}</strong>}
              <span>{formatDay(current.createdAt)}</span>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}

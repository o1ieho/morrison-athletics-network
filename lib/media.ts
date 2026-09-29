// Helpers for media items: YouTube links and image sizing.

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** The video ID from any common YouTube link (watch, youtu.be, shorts, embed, live), or null. */
export function youtubeId(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const [, kind, value] = url.pathname.split("/");
      if (["shorts", "embed", "live", "v"].includes(kind)) id = value;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

export function youtubeThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Privacy-friendly embed (no tracking cookies until the viewer presses play). */
export function youtubeEmbed(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
}

/** Scales width × height down to fit within `max` on the longer side (never up). */
export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

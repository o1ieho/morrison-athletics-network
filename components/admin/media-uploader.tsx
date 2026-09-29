"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fitWithin, youtubeId, youtubeThumbnail } from "@/lib/media";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { Team } from "@/lib/types";
import { teamLabel } from "@/lib/format";

const FULL_SIZE = 2000;
const THUMB_SIZE = 600;

/** Re-encodes an image as a JPEG no larger than `max` pixels on its long side. */
async function shrink(file: File, max: number): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Could not encode image"))), "image/jpeg", 0.85),
  );
  return { blob, width, height };
}

/**
 * Uploads straight from the browser to Supabase Storage (so large phone photos
 * never pass through the website's server). Storage and database rules only
 * accept this from admins.
 */
export function MediaUploader({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const [teamId, setTeamId] = useState("");
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    const db = getBrowserClient();
    setBusy(true);
    let done = 0;
    const failures: string[] = [];

    for (const file of Array.from(files)) {
      setStatus({ text: `Uploading ${done + 1} of ${files.length}…` });
      try {
        const [full, thumb] = await Promise.all([shrink(file, FULL_SIZE), shrink(file, THUMB_SIZE)]);
        const base = `photos/${crypto.randomUUID()}`;
        const paths = [`${base}.jpg`, `${base}-thumb.jpg`];
        for (const [path, blob] of [
          [paths[0], full.blob],
          [paths[1], thumb.blob],
        ] as const) {
          const { error } = await db.storage.from("media").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
          if (error) throw error;
        }
        const publicUrl = (path: string) => db.storage.from("media").getPublicUrl(path).data.publicUrl;
        const { error } = await db.from("media").insert({
          kind: "photo",
          title: files.length === 1 ? title.trim() : title.trim() || "",
          url: publicUrl(paths[0]),
          thumbnail_url: publicUrl(paths[1]),
          storage_paths: paths,
          width: full.width,
          height: full.height,
          team_id: teamId || null,
        });
        if (error) {
          await db.storage.from("media").remove(paths);
          throw error;
        }
        done += 1;
      } catch (error) {
        failures.push(`${file.name}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }

    setBusy(false);
    setStatus(
      failures.length
        ? { text: `Uploaded ${done}, ${failures.length} failed. ${failures.join("; ")}`, error: true }
        : { text: `Uploaded ${done} photo${done === 1 ? "" : "s"}.` },
    );
    setTitle("");
    router.refresh();
  }

  async function addVideo(event: React.FormEvent) {
    event.preventDefault();
    const id = youtubeId(link);
    if (!id) {
      setStatus({ text: "That doesn't look like a YouTube video link.", error: true });
      return;
    }
    setBusy(true);
    const { error } = await getBrowserClient().from("media").insert({
      kind: "video",
      title: title.trim(),
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail_url: youtubeThumbnail(id),
      team_id: teamId || null,
    });
    setBusy(false);
    if (error) {
      setStatus({ text: `Could not add the video: ${error.message}`, error: true });
      return;
    }
    setStatus({ text: "Video added." });
    setLink("");
    setTitle("");
    router.refresh();
  }

  return (
    <div className="form">
      <div className="form-row">
        <label className="field">
          Caption (optional)
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Senior night vs TAS" maxLength={140} />
        </label>
        <label className="field">
          Team (optional)
          <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
            <option value="">All teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {teamLabel(team)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        Photos
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple disabled={busy} onChange={(event) => uploadPhotos(event.target.files).then(() => (event.target.value = ""))} />
        <span className="hint">Choose one or more photos. They&apos;re resized on this device before uploading, so phone photos are fine.</span>
      </label>

      <form className="form-row" onSubmit={addVideo} style={{ alignItems: "end" }}>
        <label className="field">
          Or a YouTube link
          <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://youtu.be/…" inputMode="url" />
        </label>
        <div>
          <button className="button" type="submit" disabled={busy || !link.trim()}>
            Add video
          </button>
        </div>
      </form>

      {status && <div className={`notice ${status.error ? "error" : ""}`}>{status.text}</div>}
    </div>
  );
}

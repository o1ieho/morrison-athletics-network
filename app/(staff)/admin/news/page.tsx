import type { Metadata } from "next";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { getAdminData } from "@/lib/admin-data";
import { formatDay, teamLabel } from "@/lib/format";
import type { Announcement, Team } from "@/lib/types";
import { deleteAnnouncement, saveAnnouncement } from "../actions";

export const metadata: Metadata = { title: "News · Admin" };

const CATEGORIES = [
  ["game-day", "Game day"],
  ["team-news", "Team news"],
  ["transportation", "Transportation"],
  ["achievement", "Achievement"],
  ["department", "Department"],
] as const;

function NewsFields({ item, teams }: { item?: Announcement; teams: Team[] }) {
  return (
    <>
      {item && <input type="hidden" name="id" value={item.id} />}
      <label className="field">
        Title
        <input name="title" required defaultValue={item?.title ?? ""} />
      </label>
      <div className="form-row">
        <label className="field">
          Category
          <select name="category" defaultValue={item?.category ?? "team-news"}>
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Team (optional)
          <select name="team_id" defaultValue={item?.teamId ?? ""}>
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
        Summary
        <input name="summary" defaultValue={item?.summary ?? ""} maxLength={300} />
      </label>
      <label className="field">
        Body
        <textarea name="body" defaultValue={item?.body ?? ""} />
        <span className="hint">Leave a blank line between paragraphs.</span>
      </label>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="publish" defaultChecked={item ? Boolean(item.publishedAt) : true} /> Published
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="pinned" defaultChecked={item?.pinned ?? false} /> Pinned to top
        </label>
      </div>
    </>
  );
}

export default async function AdminNews() {
  const data = await getAdminData();
  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <p className="eyebrow">Admin</p>
        <h1>News</h1>
      </div>
      <section className="card card-pad stack">
        <h2>New post</h2>
        <AdminForm action={saveAnnouncement} submitLabel="Save post" resetOnSuccess>
          <NewsFields teams={data.teams} />
        </AdminForm>
      </section>
      <section className="stack">
        {data.announcements.map((item) => (
          <details key={item.id} className="card card-pad">
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>
              {item.title}{" "}
              <span className="muted small">
                {item.publishedAt ? `Published ${formatDay(item.publishedAt)}` : "Draft"}
                {item.pinned ? " · Pinned" : ""}
              </span>
            </summary>
            <div className="stack" style={{ marginTop: 12 }}>
              <AdminForm action={saveAnnouncement} submitLabel="Save">
                <NewsFields item={item} teams={data.teams} />
              </AdminForm>
              <form action={deleteAnnouncement}>
                <input type="hidden" name="id" value={item.id} />
                <ConfirmButton className="button small secondary" message={`Delete "${item.title}"?`}>
                  Delete post
                </ConfirmButton>
              </form>
            </div>
          </details>
        ))}
        {!data.announcements.length && <div className="card empty">No posts yet.</div>}
      </section>
    </div>
  );
}

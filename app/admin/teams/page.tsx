"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import "../../admin-crud.css";

export default function AdminTeamsPage() {
  const supabase = createBrowserClient();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [sportId, setSportId] = useState("basketball");
  const [level, setLevel] = useState("Varsity");
  const [gender, setGender] = useState("boys");
  const [seasonStatus, setSeasonStatus] = useState("upcoming");
  const [conference, setConference] = useState("TISSA");
  const [slug, setSlug] = useState("");

  const loadTeams = async () => {
    const { data } = await supabase.from("teams").select("*").order("name");
    if (data) setTeams(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const generatedSlug = slug || `${city}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { error } = await supabase.from("teams").upsert({
      id: id || generatedSlug.substring(0, 3).toUpperCase(),
      sport_id: sportId,
      slug: generatedSlug,
      name,
      city,
      level,
      gender,
      season_status: seasonStatus,
      conference,
    });
    
    if (!error) {
      setId(""); setName(""); setCity(""); setSlug("");
      await loadTeams();
    } else {
      console.error(error);
      setLoading(false);
    }
  };

  const handleDelete = async (deleteId: string) => {
    if (!confirm("Are you sure?")) return;
    setLoading(true);
    await supabase.from("teams").delete().eq("id", deleteId);
    await loadTeams();
  };

  return (
    <main className="page section admin-shell">
      <Link href="/admin" className="meta" style={{display: 'inline-block', marginBottom: 16}}>
        &larr; Back to dashboard
      </Link>
      <p className="eyebrow">Admin</p>
      <h1>Manage Teams</h1>
      
      <div className="grid two">
        <div>
          <h2>Existing Teams</h2>
          {loading && <p>Loading...</p>}
          <table className="admin-table">
            <thead>
              <tr><th>ID</th><th>City & Name</th><th>Sport</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {teams.map(t => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.city} {t.name}</td>
                  <td>{t.sport_id} · {t.gender || "team"} · {t.level}</td>
                  <td>{t.season_status || (t.active ? "active" : "not offered")}</td>
                  <td>
                    <button className="btn-sm delete" onClick={() => handleDelete(t.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div>
          <h2>Add / Edit Team</h2>
          <form className="admin-form" onSubmit={handleSubmit}>
            <label>ID (e.g. MAT)<input required value={id} onChange={e => setId(e.target.value)} /></label>
            <label>City<input required value={city} onChange={e => setCity(e.target.value)} /></label>
            <label>Name<input required value={name} onChange={e => setName(e.target.value)} /></label>
            <label>Sport
              <select value={sportId} onChange={e => setSportId(e.target.value)}>
                <option value="basketball">Basketball</option>
                <option value="soccer">Soccer</option>
                <option value="volleyball">Volleyball</option>
              </select>
            </label>
            <label>Gender / Division
              <select value={gender} onChange={e => setGender(e.target.value)}>
                <option value="boys">Boys</option>
                <option value="girls">Girls</option>
                <option value="coed">Coed</option>
              </select>
            </label>
            <label>Level
              <select value={level} onChange={e => setLevel(e.target.value)}>
                <option value="Varsity">Varsity</option>
                <option value="JV">JV</option>
                <option value="Team">Team</option>
              </select>
            </label>
            <label>Season Status
              <select value={seasonStatus} onChange={e => setSeasonStatus(e.target.value)}>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="not_offered">Not offered this season</option>
              </select>
            </label>
            <label>Conference<input required value={conference} onChange={e => setConference(e.target.value)} /></label>
            <label>Slug (optional)<input value={slug} onChange={e => setSlug(e.target.value)} /></label>
            <button type="submit" className="button" disabled={loading}>Save Team</button>
          </form>
        </div>
      </div>
    </main>
  );
}

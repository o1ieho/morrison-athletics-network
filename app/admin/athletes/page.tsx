"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import "../../admin-crud.css";

export default function AdminAthletesPage() {
  const supabase = createBrowserClient();
  const [athletes, setAthletes] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [id, setId] = useState("");
  const [fullName, setFullName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [position, setPosition] = useState("");
  const [grade, setGrade] = useState("11");

  const loadData = async () => {
    const [athletesRes, teamsRes] = await Promise.all([
      supabase.from("athletes").select("*, athlete_seasons(team_id, jersey_number, position, grade)").order("full_name"),
      supabase.from("teams").select("id, name, city").order("name")
    ]);
    if (athletesRes.data) setAthletes(athletesRes.data);
    if (teamsRes.data) {
      setTeams(teamsRes.data);
      if (teamsRes.data.length > 0) setTeamId(teamsRes.data[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const newId = id || `p${Date.now()}`;
    
    const { error: aError } = await supabase.from("athletes").upsert({
      id: newId,
      slug,
      full_name: fullName,
      bio: `${fullName} is an athlete.`,
    });
    
    if (!aError) {
      await supabase.from("athlete_seasons").upsert({
        athlete_id: newId,
        season_id: "2026-27",
        team_id: teamId,
        jersey_number: jerseyNumber ? parseInt(jerseyNumber) : null,
        position,
        grade,
      });
      
      setId(""); setFullName(""); setJerseyNumber(""); setPosition("");
      await loadData();
    } else {
      console.error(aError);
      setLoading(false);
    }
  };

  const handleDelete = async (deleteId: string) => {
    if (!confirm("Are you sure?")) return;
    setLoading(true);
    await supabase.from("athletes").delete().eq("id", deleteId);
    await loadData();
  };

  return (
    <main className="page section admin-shell">
      <Link href="/admin" className="meta" style={{display: 'inline-block', marginBottom: 16}}>
        &larr; Back to dashboard
      </Link>
      <p className="eyebrow">Admin</p>
      <h1>Manage Athletes</h1>
      
      <div className="grid two">
        <div>
          <h2>Existing Athletes</h2>
          {loading && <p>Loading...</p>}
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Team</th><th># / Pos</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {athletes.map(a => (
                <tr key={a.id}>
                  <td>{a.full_name}</td>
                  <td>{a.athlete_seasons?.[0]?.team_id}</td>
                  <td>#{a.athlete_seasons?.[0]?.jersey_number} / {a.athlete_seasons?.[0]?.position}</td>
                  <td>
                    <button className="btn-sm delete" onClick={() => handleDelete(a.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div>
          <h2>Add / Edit Athlete</h2>
          <form className="admin-form" onSubmit={handleSubmit}>
            <label>ID (optional for new)<input value={id} onChange={e => setId(e.target.value)} /></label>
            <label>Full Name<input required value={fullName} onChange={e => setFullName(e.target.value)} /></label>
            <label>Team
              <select value={teamId} onChange={e => setTeamId(e.target.value)}>
                {teams.map(t => <option key={t.id} value={t.id}>{t.city} {t.name}</option>)}
              </select>
            </label>
            <label>Jersey #<input type="number" value={jerseyNumber} onChange={e => setJerseyNumber(e.target.value)} /></label>
            <label>Position<input value={position} onChange={e => setPosition(e.target.value)} /></label>
            <label>Grade<input required value={grade} onChange={e => setGrade(e.target.value)} /></label>
            <button type="submit" className="button" disabled={loading}>Save Athlete</button>
          </form>
        </div>
      </div>
    </main>
  );
}

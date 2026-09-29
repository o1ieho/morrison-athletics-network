"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import "../../admin-crud.css";

export default function AdminGamesPage() {
  const supabase = createBrowserClient();
  const [games, setGames] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [id, setId] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("scheduled");

  const loadData = async () => {
    const [gamesRes, teamsRes] = await Promise.all([
      supabase.from("games").select("*, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)").order("starts_at"),
      supabase.from("teams").select("id, name, city").order("name")
    ]);
    if (gamesRes.data) setGames(gamesRes.data);
    if (teamsRes.data) {
      setTeams(teamsRes.data);
      if (teamsRes.data.length > 0) {
        setHomeTeamId(teamsRes.data[0].id);
        setAwayTeamId(teamsRes.data[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.from("games").upsert({
      id: id || `game-${Date.now()}`,
      season_id: "2026-27",
      sport_id: "basketball",
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      starts_at: startsAt,
      location,
      status,
    });
    
    if (!error) {
      setId(""); setStartsAt(""); setLocation("");
      await loadData();
    } else {
      console.error(error);
      setLoading(false);
    }
  };

  const handleDelete = async (deleteId: string) => {
    if (!confirm("Are you sure?")) return;
    setLoading(true);
    await supabase.from("games").delete().eq("id", deleteId);
    await loadData();
  };

  return (
    <main className="page section admin-shell">
      <Link href="/admin" className="meta" style={{display: 'inline-block', marginBottom: 16}}>
        &larr; Back to dashboard
      </Link>
      <p className="eyebrow">Admin</p>
      <h1>Manage Games</h1>
      
      <div className="grid two">
        <div>
          <h2>Existing Games</h2>
          {loading && <p>Loading...</p>}
          <table className="admin-table">
            <thead>
              <tr><th>Date</th><th>Matchup</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {games.map(g => (
                <tr key={g.id}>
                  <td>{new Date(g.starts_at).toLocaleDateString()}</td>
                  <td>{g.away_team?.name} @ {g.home_team?.name}</td>
                  <td>{g.status}</td>
                  <td>
                    <button className="btn-sm delete" onClick={() => handleDelete(g.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div>
          <h2>Add / Edit Game</h2>
          <form className="admin-form" onSubmit={handleSubmit}>
            <label>ID (optional for new)<input value={id} onChange={e => setId(e.target.value)} /></label>
            <label>Home Team
              <select value={homeTeamId} onChange={e => setHomeTeamId(e.target.value)}>
                {teams.map(t => <option key={t.id} value={t.id}>{t.city} {t.name}</option>)}
              </select>
            </label>
            <label>Away Team
              <select value={awayTeamId} onChange={e => setAwayTeamId(e.target.value)}>
                {teams.map(t => <option key={t.id} value={t.id}>{t.city} {t.name}</option>)}
              </select>
            </label>
            <label>Starts At (ISO)<input required type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} /></label>
            <label>Location<input required value={location} onChange={e => setLocation(e.target.value)} /></label>
            <label>Status
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="final">Final</option>
              </select>
            </label>
            <button type="submit" className="button" disabled={loading}>Save Game</button>
          </form>
        </div>
      </div>
    </main>
  );
}

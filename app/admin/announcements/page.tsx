"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import "../../admin-crud.css";

export default function AdminAnnouncementsPage() {
  const supabase = createBrowserClient();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("team-news");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const loadData = async () => {
    const { data } = await supabase.from("announcements").select("*").order("published_at", { ascending: false });
    if (data) setAnnouncements(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    
    const { error } = await supabase.from("announcements").upsert({
      slug,
      title,
      category,
      summary,
      body,
      pinned,
      published_at: new Date().toISOString(),
    }, { onConflict: 'slug' });
    
    if (!error) {
      setTitle(""); setSummary(""); setBody(""); setPinned(false);
      await loadData();
    } else {
      console.error(error);
      setLoading(false);
    }
  };

  const handleDelete = async (deleteId: string) => {
    if (!confirm("Are you sure?")) return;
    setLoading(true);
    await supabase.from("announcements").delete().eq("id", deleteId);
    await loadData();
  };

  return (
    <main className="page section admin-shell">
      <Link href="/admin" className="meta" style={{display: 'inline-block', marginBottom: 16}}>
        &larr; Back to dashboard
      </Link>
      <p className="eyebrow">Admin</p>
      <h1>Manage Announcements</h1>
      
      <div className="grid two">
        <div>
          <h2>Existing Announcements</h2>
          {loading && <p>Loading...</p>}
          <table className="admin-table">
            <thead>
              <tr><th>Title</th><th>Category</th><th>Pinned</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {announcements.map(a => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td>{a.category}</td>
                  <td>{a.pinned ? "Yes" : "No"}</td>
                  <td>
                    <button className="btn-sm delete" onClick={() => handleDelete(a.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div>
          <h2>Add / Edit Announcement</h2>
          <form className="admin-form" onSubmit={handleSubmit}>
            <label>Title<input required value={title} onChange={e => setTitle(e.target.value)} /></label>
            <label>Category
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option value="team-news">Team News</option>
                <option value="achievement">Achievement</option>
                <option value="department">Department</option>
                <option value="game-day">Game Day</option>
              </select>
            </label>
            <label>Summary<textarea required rows={3} value={summary} onChange={e => setSummary(e.target.value)} /></label>
            <label>Body<textarea required rows={5} value={body} onChange={e => setBody(e.target.value)} /></label>
            <label style={{flexDirection: 'row', alignItems: 'center'}}>
              <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
              Pinned
            </label>
            <button type="submit" className="button" disabled={loading}>Save Announcement</button>
          </form>
        </div>
      </div>
    </main>
  );
}

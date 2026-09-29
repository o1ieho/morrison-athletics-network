import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Megaphone, Shield, Sparkles } from "lucide-react";
import { adminPlaybook, adminSections } from "@/lib/admin";

export default function AdminPage() {
  const dailySections = adminSections.slice(0, 4);
  const supportingSections = adminSections.slice(4);

  return (
    <main className="page section admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Protected Admin</p>
          <h1>Season control center</h1>
          <p>
            Morrison Academy Taipei Athletics changes all year. This dashboard is designed for live announcements,
            rolling schedules, tryout rosters, media drops, standings, and operator workflows without touching code.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/admin/announcements">
              <Megaphone size={18} /> Post Announcement
            </Link>
            <Link className="button-secondary" href="/admin/games">
              <CalendarClock size={18} /> Update Schedule
            </Link>
            <Link className="button-ghost dark" href="/operator/live">
              <Shield size={18} /> Live Operator
            </Link>
          </div>
        </div>
        <aside className="admin-status-card">
          <p className="eyebrow">Operating Model</p>
          <strong>Editable-first, season-long</strong>
          <span>Announcements and schedules are the fastest path to real usefulness.</span>
        </aside>
      </section>

      <section className="admin-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">High-touch workflows</p>
            <h2>Update these constantly</h2>
          </div>
        </div>
        <div className="grid four">
          {dailySections.map((section) => (
            <article className="card admin-card" key={section.href}>
              <p className="eyebrow">{section.priority} · {section.count} records</p>
              <h3>{section.label}</h3>
              <p>{section.description}</p>
              <Link className="button-secondary" href={section.href}>
                Manage <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel split">
        <div>
          <p className="eyebrow">Admin Playbook</p>
          <h2>Built for on-the-fly school-year changes</h2>
          <div className="admin-checklist">
            {adminPlaybook.map((item) => (
              <span key={item}><CheckCircle2 size={18} /> {item}</span>
            ))}
          </div>
        </div>
        <div className="grid">
          {supportingSections.map((section) => (
            <article className="card admin-card compact-card" key={section.href}>
              <p className="eyebrow">{section.priority} · {section.count} records</p>
              <h3>{section.label}</h3>
              <p>{section.description}</p>
              <Link className="button-secondary" href={section.href}>
                Open <ArrowRight size={16} />
              </Link>
            </article>
          ))}
          <article className="card admin-card compact-card operator-admin-card">
            <p className="eyebrow">Game Day</p>
            <h3>Live Stat Operator</h3>
            <p>A distinct game-day interface for rapid basketball event entry and future realtime scoring.</p>
            <Link className="button" href="/operator/live">
              <Sparkles size={16} /> Launch Operator
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}

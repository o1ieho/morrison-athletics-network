import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function AdminSectionPage({
  title,
  description,
  fields,
}: {
  title: string;
  description: string;
  fields: string[];
}) {
  return (
    <main className="page section admin-shell">
      <p className="eyebrow">Admin</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <section className="card admin-card">
        <h2>Structured workflow placeholder</h2>
        <p className="meta">This replaces the old JSON textarea admin pattern with a dedicated management surface.</p>
        <div className="grid three">
          {fields.map((field) => (
            <label className="card compact" key={field}>
              <span className="meta">{field}</span>
              <input aria-label={field} style={{ width: "100%", minHeight: 40, marginTop: 8 }} />
            </label>
          ))}
        </div>
      </section>
      <Link className="button-secondary" href="/admin">
        Back to dashboard <ArrowRight size={16} />
      </Link>
    </main>
  );
}

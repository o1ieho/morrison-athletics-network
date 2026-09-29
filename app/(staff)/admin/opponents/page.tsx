import type { Metadata } from "next";
import { AdminForm } from "@/components/admin/admin-form";
import { getAdminData } from "@/lib/admin-data";
import { saveOpponent } from "../actions";

export const metadata: Metadata = { title: "Opponents · Admin" };

export default async function AdminOpponents() {
  const data = await getAdminData();
  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <p className="eyebrow">Admin</p>
        <h1>Opponents</h1>
        <p className="muted">The short name shows on scoreboards and in the operator console (e.g. &quot;TAS&quot;).</p>
      </div>
      <section className="card card-pad stack">
        <h2>Add an opponent</h2>
        <AdminForm action={saveOpponent} submitLabel="Add opponent" resetOnSuccess>
          <div className="form-row">
            <label className="field">
              School / team name
              <input name="name" required placeholder="Taipei American School" />
            </label>
            <label className="field">
              Short name
              <input name="short_name" required placeholder="TAS" maxLength={24} />
            </label>
          </div>
        </AdminForm>
      </section>
      <section className="stack">
        {data.opponents.map((opponent) => (
          <details key={opponent.id} className="card card-pad">
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>
              {opponent.name} <span className="muted small">({opponent.shortName})</span>
            </summary>
            <div style={{ marginTop: 12 }}>
              <AdminForm action={saveOpponent} submitLabel="Save">
                <input type="hidden" name="id" value={opponent.id} />
                <div className="form-row">
                  <label className="field">
                    Name
                    <input name="name" required defaultValue={opponent.name} />
                  </label>
                  <label className="field">
                    Short name
                    <input name="short_name" required defaultValue={opponent.shortName} maxLength={24} />
                  </label>
                </div>
              </AdminForm>
            </div>
          </details>
        ))}
        {!data.opponents.length && <div className="card empty">No opponents yet.</div>}
      </section>
    </div>
  );
}

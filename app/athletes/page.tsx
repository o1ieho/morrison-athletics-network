import { AthleteCard } from "@/components/cards";
import { getAthletes } from "@/lib/supabase-queries";

export default async function AthletesPage() {
  const athletes = await getAthletes();
  return (
    <main className="page section">
      <p className="eyebrow">Athletes</p>
      <h1>Persistent athlete profiles</h1>
      <div className="grid four">
        {athletes.map((athlete) => <AthleteCard athlete={athlete} key={athlete.id} />)}
      </div>
    </main>
  );
}

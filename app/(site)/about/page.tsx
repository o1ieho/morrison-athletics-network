import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="page">
      <div className="container stack" style={{ maxWidth: 720 }}>
        <p className="eyebrow">About</p>
        <h1>MAT Athletics</h1>
        <p>
          The home for Morrison Academy Taipei Broncos basketball: schedules, live scores, box scores and season stats
          for the Varsity and JV boys&apos; and girls&apos; teams.
        </p>
        <p>
          During games, a student stat operator enters every play from the sideline and this site updates in real time.
          Stats are unofficial and may be corrected after the game.
        </p>
        <p className="muted">Questions or corrections? Contact the MAT athletics department.</p>
      </div>
    </main>
  );
}

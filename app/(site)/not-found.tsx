import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <div className="container stack" style={{ maxWidth: 560, textAlign: "center", justifyItems: "center" }}>
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p className="muted">That page doesn&apos;t exist, or the game or player may have been removed.</p>
        <Link className="button" href="/">
          Go home
        </Link>
      </div>
    </main>
  );
}

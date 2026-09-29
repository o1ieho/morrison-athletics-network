"use client";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page">
      <div className="container stack" style={{ maxWidth: 560, textAlign: "center", justifyItems: "center" }}>
        <p className="eyebrow">Something went wrong</p>
        <h1>Couldn&apos;t load this page</h1>
        <p className="muted">The scores service may be briefly unavailable. Try again in a moment.</p>
        {process.env.NODE_ENV !== "production" && <p className="notice error">{error.message}</p>}
        <button className="button" type="button" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}

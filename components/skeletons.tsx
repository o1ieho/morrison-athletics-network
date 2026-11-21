// Content-shaped loading placeholders for slow navigations (loading.tsx).
// Flat grey blocks with no shimmer. The whole skeleton fades in only after
// 300ms, so fast loads never flash it.

function Lines({ widths }: { widths: number[] }) {
  return (
    <>
      {widths.map((width, index) => (
        <span key={index} className="sk-bar" style={{ width: `${width}%` }} />
      ))}
    </>
  );
}

function Skeleton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <main className="page skeleton" aria-busy="true">
      <span className="visually-hidden" role="status">
        {label}
      </span>
      <div className="container stack" aria-hidden="true">
        {children}
      </div>
    </main>
  );
}

export function GameSkeleton() {
  return (
    <Skeleton label="Loading game…">
      <span className="sk-bar" style={{ width: 160 }} />
      <div className="sk-board">
        <span className="sk-score" />
        <span className="sk-score" />
      </div>
      <span className="sk-block sk-lead" />
      <div className="sk-panels">
        {[0, 1, 2].map((index) => (
          <div key={index} className="sk-panel">
            <span className="sk-title" />
            <Lines widths={[100, 92, 85, 100, 92, 85]} />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

export function HomeSkeleton() {
  return (
    <Skeleton label="Loading…">
      <span className="sk-block sk-feature" />
      <div className="home-row">
        {[0, 1].map((panel) => (
          <div key={panel} className="sk-panel">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="sk-row">
                <span className="sk-date" />
                <span className="sk-row-text">
                  <Lines widths={[70, 45]} />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

/** Player and team pages: heading, six stat tiles, then table rows. */
export function ProfileSkeleton({ label }: { label: string }) {
  return (
    <Skeleton label={label}>
      <span className="sk-bar sk-heading" />
      <div className="sk-tiles">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <span key={index} className="sk-tile" />
        ))}
      </div>
      <div className="sk-table">
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <span key={index} className="sk-table-row" />
        ))}
      </div>
    </Skeleton>
  );
}

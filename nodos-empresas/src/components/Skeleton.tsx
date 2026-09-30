/** Placeholder con efecto "shimmer" para usar mientras se cargan datos de
 * Supabase, en vez de dejar la pantalla en blanco o solo texto "Cargando...". */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonStatTiles({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="mt-2 h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-shell">
      <div className="p-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 border-b py-2.5 last:border-0" style={{ borderColor: "var(--line)" }}>
            {Array.from({ length: cols }).map((_, c) => (
              <SkeletonBlock key={c} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

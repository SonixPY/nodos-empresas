"use client";

interface BulkDeleteBarProps {
  count: number;
  deleting: boolean;
  onDelete: () => void;
  onClear: () => void;
  label?: string;
}

/** Barra que aparece arriba de una tabla cuando hay filas seleccionadas,
 * con la acción de borrado en lote. */
export default function BulkDeleteBar({ count, deleting, onDelete, onClear, label }: BulkDeleteBarProps) {
  if (count === 0) return null;

  return (
    <div className="bulk-bar">
      <span>
        <strong>{count}</strong> {label ?? (count === 1 ? "fila seleccionada" : "filas seleccionadas")}
      </span>
      <span className="flex items-center gap-3">
        <button onClick={onClear} disabled={deleting} className="text-carbon/60 underline hover:text-carbon disabled:opacity-50">
          cancelar
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="btn"
          style={{ background: "var(--color-bad)", color: "#fff", padding: "0.4rem 0.8rem" }}
        >
          {deleting ? (
            <>
              <span className="spinner" /> Eliminando...
            </>
          ) : (
            `Eliminar ${count === 1 ? "" : "seleccionados"}`
          )}
        </button>
      </span>
    </div>
  );
}

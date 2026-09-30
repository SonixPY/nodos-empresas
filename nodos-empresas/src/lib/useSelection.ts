import { useCallback, useMemo, useState } from "react";

/** Maneja la selección múltiple de filas por id, para borrado en lote en
 * las tablas de la app. */
export function useSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = ids.some((id) => selected.has(id));

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allCurrentlySelected = ids.length > 0 && ids.every((id) => prev.has(id));
      return allCurrentlySelected ? new Set() : new Set(ids);
    });
  }, [ids]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return { selected, selectedIds, toggle, toggleAll, allSelected, someSelected, clear };
}

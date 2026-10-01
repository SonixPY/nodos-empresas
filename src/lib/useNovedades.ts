"use client";

import { useCallback, useEffect, useState } from "react";
import type { Novedad } from "@/lib/novedades";

export type EstadoNovedades = "cargando" | "ok" | "error";

interface Resultado {
  clave: string;
  estado: "ok" | "error";
  items: Novedad[];
  /** Momento de la respuesta, para calcular "hace X" sin leer el reloj al renderizar. */
  ahora: number;
}

/** Trae los titulares de /api/novedades. Solo manda ids de tema del
 * catálogo (nunca datos de las empresas). Con `enabled` en false no pide. */
export function useNovedades(temaIds: string[], enabled: boolean) {
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const qs = temaIds.map((t) => `t=${encodeURIComponent(t)}`).join("&");
  const clave = `${qs}#${intento}`;
  const vacio = temaIds.length === 0;

  useEffect(() => {
    if (!enabled || vacio) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/novedades?${qs}`, { signal: ctrl.signal, credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { items?: Novedad[] };
        setResultado({ clave, estado: "ok", items: Array.isArray(body.items) ? body.items : [], ahora: Date.now() });
      } catch {
        if (ctrl.signal.aborted) return;
        setResultado({ clave, estado: "error", items: [], ahora: Date.now() });
      }
    })();
    return () => ctrl.abort();
  }, [enabled, vacio, qs, clave]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  if (enabled && vacio) return { estado: "ok" as EstadoNovedades, items: [] as Novedad[], ahora: 0, reintentar };
  const vigente = resultado && resultado.clave === clave ? resultado : null;
  const estado: EstadoNovedades = vigente ? vigente.estado : "cargando";
  return { estado, items: vigente?.items ?? [], ahora: vigente?.ahora ?? 0, reintentar };
}

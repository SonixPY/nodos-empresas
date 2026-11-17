"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import type { Leccion } from "@/lib/nodos/aprender";
import { useCarrera } from "./CarreraProvider";
import { Aviso, CasoRealBloque, NodoIcono } from "./piezas";

/** Lecciones de NODO aprendidas en todas tus carreras. */
export default function Biblioteca() {
  const { contenido, almacen } = useCarrera();
  const [aprendidas, setAprendidas] = useState<{ leccion_id: string; desbloqueada_en: string }[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    almacen
      .cargarLecciones()
      .then(setAprendidas)
      .catch(() => setError(true));
  }, [almacen]);

  const lecciones = useMemo(() => {
    const m = new Map<string, Leccion>();
    for (const s of contenido?.situaciones.values() ?? []) if (!m.has(s.leccion.id)) m.set(s.leccion.id, s.leccion);
    return m;
  }, [contenido]);

  if (!contenido) return null;
  const ids = new Set((aprendidas ?? []).map((a) => a.leccion_id));
  const bloqueadas = Array.from(lecciones.keys()).filter((id) => !ids.has(id)).length;

  return (
    <div>
      <div className="flex items-center gap-3">
        <NodoIcono size={44} />
        <div>
          <h1>Biblioteca</h1>
          <p className="text-carbon/70">
            {aprendidas ? `${ids.size} de ${lecciones.size} lecciones aprendidas, sumando todas tus carreras.` : error ? "No pudimos cargar tus lecciones." : "Cargando…"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-4 md:grid-cols-2">
        {(aprendidas ?? []).map((a) => {
          const l = lecciones.get(a.leccion_id);
          if (!l) return null;
          const caso = l.casoReal ? contenido.casos.get(l.casoReal) : undefined;
          return (
            <article key={a.leccion_id} className="rounded-lg border border-[var(--line)] bg-[var(--superficie)] p-5">
              <p className="text-xs text-carbon/60">Aprendida el {new Date(a.desbloqueada_en).toLocaleDateString("es-PY")}</p>
              <h2 className="mt-1 !text-lg">{l.titulo}</h2>
              <ol className="mt-2 space-y-1 text-sm leading-relaxed">
                {l.reglas.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-display font-bold text-cobre-hover">{i + 1}.</span>
                    {r}
                  </li>
                ))}
              </ol>
              {caso?.verificado && (
                <div className="mt-3">
                  <CasoRealBloque caso={caso} />
                </div>
              )}
            </article>
          );
        })}
        {aprendidas &&
          Array.from({ length: Math.min(bloqueadas, 6) }, (_, i) => (
            <div key={`b${i}`} className="flex items-center gap-3 rounded-lg border border-dashed border-bosque/40 p-5 text-sm text-carbon/60">
              <Lock size={18} aria-hidden /> Lección por descubrir: aparece cuando vivas la situación.
            </div>
          ))}
      </div>
      {aprendidas && bloqueadas > 6 && <p className="mt-3 text-sm text-carbon/60">Y {bloqueadas - 6} más por descubrir.</p>}
      <Aviso className="mt-8" />
    </div>
  );
}

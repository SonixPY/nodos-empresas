"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PARAMETROS, herenciaInicial, type Arranque } from "@/lib/nodos/aprender";
import { useCarrera } from "./CarreraProvider";
import { Aviso, NodoIcono, gs } from "./piezas";

const ARRANQUES: { id: Arranque; titulo: string; texto: string }[] = [
  { id: "ajustado", titulo: "Ajustado", texto: "Sueldo justo y casi sin colchón. Cada imprevisto pesa." },
  { id: "normal", titulo: "Normal", texto: "Un sueldo promedio y un poco de efectivo para arrancar." },
  { id: "holgado", titulo: "Holgado", texto: "Mejor sueldo y algo ahorrado. Más margen para equivocarte." },
];

/** Pantalla inicial: se elige el arranque y empieza la carrera. */
export default function EmpezarCarrera() {
  const { empezar, ocupado, almacen } = useCarrera();
  const [arranque, setArranque] = useState<Arranque>("normal");
  const [puntos, setPuntos] = useState(0);

  useEffect(() => {
    almacen
      .cargarLecciones()
      .then((l) => setPuntos(l.length))
      .catch(() => setPuntos(0));
  }, [almacen]);

  const a = PARAMETROS.arranques[arranque];
  const herencia = herenciaInicial(puntos, a.sueldo);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-4">
        <NodoIcono size={56} />
        <div>
          <h1>Tu carrera</h1>
          <p className="t-body-lg text-carbon/75">Empezás como empleado. Lo que hagas con tu plata, mes a mes, decide el resto.</p>
        </div>
      </div>

      <ul className="mt-6 space-y-2 text-[15px] leading-relaxed">
        <li>Cada mes cobrás, pagás y aparecen situaciones en tu escritorio. Algunas se basan en casos reales.</li>
        <li>No hay respuestas correctas a la vista: decidís y ves las consecuencias. Después, NODO te explica qué pasó.</li>
        <li>Si te fundís, la carrera termina. Lo que aprendiste queda como herencia para la próxima.</li>
      </ul>

      <fieldset className="mt-8">
        <legend className="font-display text-lg font-semibold text-musgo">¿Cómo arrancás?</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {ARRANQUES.map((x) => {
            const p = PARAMETROS.arranques[x.id];
            const sel = arranque === x.id;
            return (
              <label
                key={x.id}
                className={`cursor-pointer rounded-lg border-2 bg-[var(--superficie)] p-4 transition ${sel ? "border-musgo" : "border-[var(--line)] hover:border-bosque"}`}
              >
                <input type="radio" name="arranque" value={x.id} checked={sel} onChange={() => setArranque(x.id)} className="sr-only" />
                <span className="font-display text-lg font-semibold text-musgo">{x.titulo}</span>
                <span className="mt-1 block text-sm text-carbon/75">{x.texto}</span>
                <span className="mt-3 block text-xs text-carbon/70">
                  Sueldo {gs(p.sueldo)} · Gastos fijos {gs(p.gastosFijos)}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {puntos > 0 && (
        <p className="mt-4 rounded-lg border border-cobre/60 bg-cobre/10 px-4 py-3 text-sm">
          Herencia de tus carreras anteriores: {puntos} {puntos === 1 ? "lección aprendida" : "lecciones aprendidas"}. Arrancás con {gs(herencia)} extra.
        </p>
      )}

      <button type="button" className="btn btn-primary mt-6 !px-6 !py-3 !text-base" disabled={ocupado} onClick={() => empezar(arranque)}>
        {ocupado && <Loader2 size={16} className="animate-spin" aria-hidden />} Empezar la carrera
      </button>
      <Aviso className="mt-6" />
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { useCarrera } from "./CarreraProvider";
import EmpezarCarrera from "./EmpezarCarrera";
import { NodoIcono } from "./piezas";

/** Muestra la pantalla solo si hay una carrera en curso; si no, el inicio o el final. */
export default function ConCarrera({ children }: { children: ReactNode }) {
  const { estado, carrera, nuevaCarreraTrasFin } = useCarrera();
  if (estado === "cargando")
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Cargando tu carrera">
        <div className="h-96 animate-pulse rounded-2xl bg-bosque/15" />
        <div className="h-96 animate-pulse rounded-2xl bg-bosque/10" />
      </div>
    );
  if (estado === "error") return null;
  if (estado === "sin-carrera") return <EmpezarCarrera />;
  if (estado === "terminada" || carrera?.estado !== "activa")
    return (
      <div className="mx-auto max-w-xl text-center">
        <div className="flex justify-center">
          <NodoIcono size={56} />
        </div>
        <h1 className="mt-3">Tu carrera terminó</h1>
        <p className="mt-2 text-carbon/75">
          Tres meses sin poder pagar cierran la carrera. Lo que aprendiste queda en tu biblioteca y te da ventaja en la próxima.
        </p>
        <button type="button" className="btn btn-primary mt-5" onClick={nuevaCarreraTrasFin}>
          Empezar otra carrera
        </button>
      </div>
    );
  return <>{children}</>;
}

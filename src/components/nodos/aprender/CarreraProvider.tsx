"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { decidir as decidirMotor, planMes, type Arranque, type Carrera, type Contenido, type PlanMes, type ResumenMes } from "@/lib/nodos/aprender";
import { ErrorAprender, almacenSupabase, type Almacen, type FilaCarrera } from "@/lib/nodos/aprender/datos";

type Estado = "cargando" | "sin-carrera" | "jugando" | "terminada" | "error";

interface Valor {
  estado: Estado;
  error: string | null;
  fila: FilaCarrera | null;
  carrera: Carrera | null;
  contenido: Contenido | null;
  plan: PlanMes | null;
  /** Resumen del último cierre (se muestra una vez). */
  resumen: ResumenMes | null;
  ocupado: boolean;
  almacen: Almacen;
  empezar: (arranque: Arranque) => Promise<void>;
  decidir: (situacion: string, opcion: string) => Promise<void>;
  cerrar: () => Promise<void>;
  verResumen: (r: ResumenMes | null) => void;
  nuevaCarreraTrasFin: () => void;
  abandonar: () => Promise<void>;
  recargar: () => void;
}

const Ctx = createContext<Valor | null>(null);

export function useCarrera(): Valor {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCarrera fuera de CarreraProvider");
  return v;
}

const mensaje = (e: unknown) => (e instanceof ErrorAprender ? e.message : "Algo falló. Probá de nuevo en un rato.");

/** Estado de la carrera compartido por todas las pantallas de Aprender. */
export default function CarreraProvider({ children, almacen = almacenSupabase }: { children: ReactNode; almacen?: Almacen }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [error, setError] = useState<string | null>(null);
  const [fila, setFila] = useState<FilaCarrera | null>(null);
  const [contenido, setContenido] = useState<Contenido | null>(null);
  const [resumen, setResumen] = useState<ResumenMes | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const ocupadoRef = useRef(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [k, f] = await Promise.all([almacen.cargarContenido(), almacen.cargarCarreraActiva()]);
        if (!vivo) return;
        setContenido(k);
        setFila(f);
        setEstado(f ? "jugando" : "sin-carrera");
        setError(null);
      } catch (e) {
        if (!vivo) return;
        setError(mensaje(e));
        setEstado("error");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [vuelta, almacen]);

  const conCandado = useCallback(async (f: () => Promise<void>) => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true);
    try {
      await f();
      setError(null);
    } catch (e) {
      setError(mensaje(e));
    } finally {
      ocupadoRef.current = false;
      setOcupado(false);
    }
  }, []);

  const empezar = useCallback(
    (arranque: Arranque) =>
      conCandado(async () => {
        if (!contenido) return;
        const f = await almacen.crearCarrera(arranque, contenido);
        setFila(f);
        setResumen(null);
        setEstado("jugando");
      }),
    [conCandado, contenido, almacen],
  );

  const decidir = useCallback(
    async (situacion: string, opcion: string) => {
      if (!fila || !contenido) return;
      const previo = fila;
      const datos = decidirMotor(fila.datos, contenido, situacion, opcion);
      setFila({ ...fila, datos });
      try {
        await almacen.guardarEstado(fila.id, datos);
        setError(null);
      } catch (e) {
        setFila(previo);
        setError(mensaje(e));
      }
    },
    [fila, contenido, almacen],
  );

  const cerrar = useCallback(
    () =>
      conCandado(async () => {
        if (!fila || !contenido) return;
        const { carrera, resumen: r } = await almacen.cerrarYGuardar(fila, contenido);
        setFila({ ...fila, datos: carrera, mes: carrera.mes, etapa: carrera.etapa, estado: carrera.estado, indice_salud: carrera.indiceSalud });
        setResumen(r);
        if (carrera.estado !== "activa") setEstado("terminada");
      }),
    [conCandado, fila, contenido, almacen],
  );

  const abandonar = useCallback(
    () =>
      conCandado(async () => {
        if (!fila) return;
        await almacen.abandonarCarrera(fila.id);
        setFila(null);
        setResumen(null);
        setEstado("sin-carrera");
      }),
    [conCandado, fila, almacen],
  );

  const valor = useMemo<Valor>(() => {
    const carrera = fila?.datos ?? null;
    return {
      estado,
      error,
      fila,
      carrera,
      contenido,
      plan: carrera && contenido && carrera.estado === "activa" ? planMes(carrera, contenido) : null,
      resumen,
      ocupado,
      almacen,
      empezar,
      decidir,
      cerrar,
      verResumen: setResumen,
      nuevaCarreraTrasFin: () => {
        setFila(null);
        setResumen(null);
        setEstado("sin-carrera");
      },
      abandonar,
      recargar: () => {
        setEstado("cargando");
        setVuelta((n) => n + 1);
      },
    };
  }, [estado, error, fila, contenido, resumen, ocupado, almacen, empezar, decidir, cerrar, abandonar]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

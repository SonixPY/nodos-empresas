/**
 * NODOS Aprender · guardado en Supabase (lado del navegador).
 * El motor es puro; acá solo se lee y se escribe. Las tablas las protege
 * RLS: cada cuenta ve y escribe solo lo suyo (migración 015 = Finanzas 029).
 */
import { supabase } from "@/lib/supabaseClient";
import { traerTodas } from "@/lib/traerTodas";
import { armarContenido, type FilaAprender } from "./contenido";
import { cerrarMes, nuevaCarrera } from "./motor";
import { nuevaSemilla } from "./azar";
import type { Carrera, Contenido, Perfil, ResumenMes } from "./tipos";
import { VERSION_ESTADO } from "./tipos";

export interface FilaCarrera {
  id: string;
  numero: number;
  estado: Carrera["estado"] | "abandonada";
  etapa: Carrera["etapa"];
  mes: number;
  indice_salud: number;
  datos: Carrera;
  created_at: string;
  cerrada_en: string | null;
}

export interface FilaTurno {
  mes: number;
  indice_salud: number;
  patrimonio: number;
  resumen: ResumenMes;
  created_at: string;
}

const COLUMNAS = "id, numero, estado, etapa, mes, indice_salud, datos, created_at, cerrada_en";

/** Error con un mensaje para mostrar tal cual. */
export class ErrorAprender extends Error {}

function falla(e: { code?: string; message?: string } | null, texto: string): never {
  // 42P01: la tabla no existe (la migración todavía no corrió).
  if (e?.code === "42P01" || e?.code === "PGRST205") throw new ErrorAprender("Aprender se está actualizando. Probá de nuevo en un rato.");
  throw new ErrorAprender(texto);
}

export async function cargarContenido(): Promise<Contenido> {
  const { data, error } = await supabase.from("aprender_contenido").select("id, tipo, datos, estado").eq("estado", "publicado");
  // Sin contenido del Panel, el juego funciona con el incluido.
  if (error) return armarContenido();
  return armarContenido((data ?? []) as FilaAprender[]);
}

export async function cargarCarreraActiva(): Promise<FilaCarrera | null> {
  const { data, error } = await supabase.from("aprender_carreras").select(COLUMNAS).eq("estado", "activa").maybeSingle<FilaCarrera>();
  if (error) falla(error, "No pudimos cargar tu carrera.");
  if (data && data.datos?.version !== VERSION_ESTADO) throw new ErrorAprender("Tu carrera es de una versión anterior del juego.");
  return data;
}

export async function cargarCarreras(): Promise<FilaCarrera[]> {
  const { data, error } = await supabase.from("aprender_carreras").select(COLUMNAS).order("created_at", { ascending: false }).limit(50);
  if (error) falla(error, "No pudimos cargar tus carreras.");
  return (data ?? []) as FilaCarrera[];
}

export async function cargarTurnos(carreraId: string): Promise<FilaTurno[]> {
  // Un turno por mes: ordenar por mes ya es un orden total y estable.
  const { data, error } = await traerTodas<FilaTurno>((desde, hasta) =>
    supabase.from("aprender_turnos").select("mes, indice_salud, patrimonio, resumen, created_at").eq("carrera_id", carreraId).order("mes").range(desde, hasta),
  );
  if (error) falla(error, "No pudimos cargar el historial.");
  return data;
}

export async function cargarLecciones(): Promise<{ leccion_id: string; desbloqueada_en: string }[]> {
  const { data, error } = await supabase.from("aprender_lecciones").select("leccion_id, desbloqueada_en").order("desbloqueada_en", { ascending: false });
  if (error) falla(error, "No pudimos cargar tus lecciones.");
  return data ?? [];
}

export async function crearCarrera(perfil: Perfil, contenido: Contenido): Promise<FilaCarrera> {
  const [{ data: puntos }, { count }] = await Promise.all([
    supabase.rpc("aprender_puntos_herencia"),
    supabase.from("aprender_carreras").select("id", { count: "exact", head: true }),
  ]);
  const c = nuevaCarrera({ semilla: nuevaSemilla(), perfil, puntosHerencia: typeof puntos === "number" ? puntos : 0 }, contenido);
  const { data, error } = await supabase
    .from("aprender_carreras")
    .insert({ numero: (count ?? 0) + 1, semilla: c.semilla, estado: c.estado, etapa: c.etapa, mes: c.mes, indice_salud: c.indiceSalud, datos: c })
    .select(COLUMNAS)
    .single<FilaCarrera>();
  if (error) falla(error, error.code === "23505" ? "Ya tenés una carrera en curso. Recargá la página." : "No pudimos crear la carrera.");
  return data;
}

/** Guarda una decisión (se puede cambiar hasta cerrar el mes). */
export async function guardarEstado(id: string, c: Carrera): Promise<void> {
  const { error } = await supabase.from("aprender_carreras").update({ datos: c }).eq("id", id).eq("mes", c.mes).eq("estado", "activa");
  if (error) falla(error, "No pudimos guardar tu decisión.");
}

/**
 * Cierra el mes: el turno se agrega primero (uno por mes y carrera), así
 * dos pestañas no pueden cerrar el mismo mes dos veces.
 */
export async function cerrarYGuardar(fila: FilaCarrera, contenido: Contenido): Promise<{ carrera: Carrera; resumen: ResumenMes }> {
  const antes = fila.datos;
  const decisiones = antes.abiertas.filter((a) => a.elegida && a.decididaEn === antes.mes).map((a) => ({ situacion: a.id, opcion: a.elegida }));
  const { carrera, resumen } = cerrarMes(antes, contenido);
  const turno = await supabase.from("aprender_turnos").insert({
    carrera_id: fila.id,
    mes: antes.mes,
    indice_salud: resumen.indiceSalud,
    patrimonio: resumen.patrimonioDespues,
    resumen,
    decisiones,
  });
  if (turno.error) falla(turno.error, turno.error.code === "23505" ? "Este mes ya se cerró en otra pestaña. Recargá la página." : "No pudimos cerrar el mes.");
  const termino = carrera.estado !== "activa";
  const { error } = await supabase
    .from("aprender_carreras")
    .update({
      datos: carrera,
      mes: carrera.mes,
      etapa: carrera.etapa,
      estado: carrera.estado,
      indice_salud: carrera.indiceSalud,
      ...(termino ? { cerrada_en: new Date().toISOString() } : {}),
    })
    .eq("id", fila.id);
  if (error) falla(error, "No pudimos guardar el cierre del mes.");
  if (resumen.lecciones.length) {
    const filas = Array.from(new Set(resumen.lecciones.map((l) => l.leccion))).map((leccion_id) => ({ leccion_id, carrera_id: fila.id }));
    // Las ya aprendidas en otra carrera se ignoran.
    await supabase.from("aprender_lecciones").upsert(filas, { onConflict: "user_id,leccion_id", ignoreDuplicates: true });
  }
  return { carrera, resumen };
}

export async function abandonarCarrera(id: string): Promise<void> {
  const { error } = await supabase.from("aprender_carreras").update({ estado: "abandonada", cerrada_en: new Date().toISOString() }).eq("id", id);
  if (error) falla(error, "No pudimos terminar la carrera.");
}

/** Todo lo que el juego lee y escribe (se puede reemplazar en pruebas). */
export interface Almacen {
  cargarContenido: typeof cargarContenido;
  cargarCarreraActiva: typeof cargarCarreraActiva;
  cargarCarreras: typeof cargarCarreras;
  cargarTurnos: typeof cargarTurnos;
  cargarLecciones: typeof cargarLecciones;
  crearCarrera: typeof crearCarrera;
  guardarEstado: typeof guardarEstado;
  cerrarYGuardar: typeof cerrarYGuardar;
  abandonarCarrera: typeof abandonarCarrera;
}

export const almacenSupabase: Almacen = {
  cargarContenido,
  cargarCarreraActiva,
  cargarCarreras,
  cargarTurnos,
  cargarLecciones,
  crearCarrera,
  guardarEstado,
  cerrarYGuardar,
  abandonarCarrera,
};

import type { SupabaseClient } from "@supabase/supabase-js";

// Listado y limpieza de archivos en Supabase Storage desde el servidor.
// Recibe el cliente que corresponda: el de la sesión del usuario (respeta las
// políticas de Storage) o, solo para borrar una cuenta entera, la service role.
// Este archivo es idéntico en finanzas-app y nodos-empresas: si lo cambiás,
// cambialo en los dos. SOLO para Route Handlers: nunca importar desde el navegador.

/** Bucket privado de NODOS Empresas: <dueño>/<empresa>/<archivo>. */
export const BUCKET_ARCHIVOS_EMPRESAS = "archivo";

const POR_PAGINA = 100;
const MAX_ARCHIVOS = 20000; // freno de seguridad ante un listado que no termina

/** Lista todas las rutas de archivos bajo `prefijo` (recorre subcarpetas y pagina). */
export async function listarArchivos(cliente: SupabaseClient, bucket: string, prefijo: string): Promise<string[]> {
  const base = prefijo.replace(/\/+$/, "");
  const rutas: string[] = [];
  const pendientes = [base];
  while (pendientes.length > 0 && rutas.length < MAX_ARCHIVOS) {
    const carpeta = pendientes.shift()!;
    for (let offset = 0; ; offset += POR_PAGINA) {
      const { data, error } = await cliente.storage.from(bucket).list(carpeta, {
        limit: POR_PAGINA,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        if (/not.?found/i.test(error.message)) return rutas; // bucket inexistente: nada que borrar
        throw new Error(error.message);
      }
      for (const item of data ?? []) {
        const ruta = carpeta ? `${carpeta}/${item.name}` : item.name;
        // Las carpetas vienen sin id ni metadata.
        if (item.id == null && !item.metadata) pendientes.push(ruta);
        else rutas.push(ruta);
      }
      if (!data || data.length < POR_PAGINA) break;
    }
  }
  return rutas;
}

/**
 * Borra todo lo que hay bajo `prefijo` (p. ej. "<user_id>/<empresa_id>" o
 * "<user_id>"). Devuelve cuántos archivos borró. Lanza un error si Storage
 * falla, para que quien llama no borre los registros dejando archivos huérfanos.
 */
export async function borrarCarpeta(cliente: SupabaseClient, bucket: string, prefijo: string): Promise<number> {
  const limpio = prefijo.replace(/^\/+|\/+$/g, "");
  // Nunca vaciar el bucket entero por un prefijo vacío o raro.
  if (!limpio || limpio.includes("..")) throw new Error("Prefijo de Storage inválido.");
  const rutas = await listarArchivos(cliente, bucket, limpio);
  let borrados = 0;
  for (let i = 0; i < rutas.length; i += POR_PAGINA) {
    const lote = rutas.slice(i, i + POR_PAGINA);
    const { data, error } = await cliente.storage.from(bucket).remove(lote);
    if (error) throw new Error(error.message);
    borrados += data?.length ?? 0;
  }
  return borrados;
}

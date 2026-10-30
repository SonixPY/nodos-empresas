/**
 * Supabase corta cada consulta en 1.000 filas ("Max rows" de la API) sin
 * avisar: con más de 1.000 gastos o compras, los totales, gráficos y la
 * detección de duplicados de las importaciones quedaban incompletos.
 *
 * `traerTodas` pide de a una página hasta que vuelve una incompleta y
 * devuelve la misma forma `{ data, error }` que una consulta normal.
 *
 * La consulta que arma `pagina` TIENE que tener un orden total y estable
 * (terminar en `.order("id")`); sin orden, Postgres puede repetir o saltear
 * filas entre páginas.
 */
export const PAGINA = 1000;

/** Hasta 200.000 filas: freno de seguridad ante un bucle por error de la API. */
const MAX_PAGINAS = 200;

type Resultado<T> = { data: T[] | null; error: { message: string; code?: string } | null };

export async function traerTodas<T, E extends Resultado<T>["error"] = Resultado<T>["error"]>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: E }>,
  tamano = PAGINA
): Promise<{ data: T[]; error: E | null }> {
  const filas: T[] = [];
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const desde = i * tamano;
    const { data, error } = await pagina(desde, desde + tamano - 1);
    if (error) return { data: filas, error };
    const lote = data ?? [];
    filas.push(...lote);
    if (lote.length < tamano) break;
  }
  return { data: filas, error: null };
}

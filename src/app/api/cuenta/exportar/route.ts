import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { BUCKET_ARCHIVOS_EMPRESAS, listarArchivos } from "@/lib/nodos/storage";

export const dynamic = "force-dynamic";

/**
 * Tablas con datos propios de cada cuenta, en NODOS Finanzas y NODOS Empresas
 * (relevadas de las migraciones de los dos repos). `id`: si tiene columna id
 * para paginar en orden. Las del Panel (leads, contenido, notas) son del
 * equipo NODOS y no datos personales de quien las cargó: no van.
 */
const TABLAS: { app: "finanzas" | "empresas" | "cuenta"; tabla: string; id: boolean }[] = [
  // NODOS Finanzas
  { app: "finanzas", tabla: "portfolio_purchases", id: true },
  { app: "finanzas", tabla: "trades", id: true },
  { app: "finanzas", tabla: "expenses", id: true },
  { app: "finanzas", tabla: "monthly_income", id: false },
  { app: "finanzas", tabla: "tarjeta_ciclos", id: true },
  { app: "finanzas", tabla: "investment_income", id: true },
  { app: "finanzas", tabla: "digital_distributions", id: true },
  { app: "finanzas", tabla: "config_lists", id: true },
  { app: "finanzas", tabla: "config_lists_sembradas", id: false },
  { app: "finanzas", tabla: "trackers", id: true },
  { app: "finanzas", tabla: "tracker_templates", id: true },
  { app: "finanzas", tabla: "learn_progress", id: false },
  { app: "finanzas", tabla: "learn_xp_log", id: true },
  { app: "finanzas", tabla: "calculator_prefs", id: false },
  { app: "finanzas", tabla: "resumen_layout", id: true },
  { app: "finanzas", tabla: "portfolio_layout", id: true },
  { app: "finanzas", tabla: "trading_layout", id: true },
  // NODOS Empresas
  { app: "empresas", tabla: "empresas", id: true },
  { app: "empresas", tabla: "accionistas", id: true },
  { app: "empresas", tabla: "movimientos_acciones", id: true },
  { app: "empresas", tabla: "beneficiarios_finales", id: true },
  { app: "empresas", tabla: "administradores", id: true },
  { app: "empresas", tabla: "obligaciones", id: true },
  { app: "empresas", tabla: "documentos", id: true },
  { app: "empresas", tabla: "poderes", id: true },
  { app: "empresas", tabla: "archivos", id: true },
  { app: "empresas", tabla: "perfil_seprelad", id: false },
  { app: "empresas", tabla: "notificaciones_enviadas", id: true },
  // Cuenta NODOS (las dos apps): suscripción y pagos, si la migración ya corrió.
  { app: "cuenta", tabla: "suscripciones", id: true },
  { app: "cuenta", tabla: "pagos", id: true },
];

const PAGINA = 1000;
const MAX_DESCARGAS = 5; // por cuenta, cada 15 minutos
const VENTANA_MS = 15 * 60 * 1000;
const MAX_FILAS = 100000; // por tabla

type Cliente = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Filas = Record<string, unknown>[];

async function leerTodo(supabase: Cliente, tabla: string, columna: string, valores: string[], conId: boolean): Promise<Filas | { error: string }> {
  const filas: Filas = [];
  for (let desde = 0; desde < MAX_FILAS; desde += PAGINA) {
    let q = supabase.from(tabla).select("*");
    q = valores.length === 1 ? q.eq(columna, valores[0]) : q.in(columna, valores);
    if (conId) q = q.order("id", { ascending: true });
    const { data, error } = await q.range(desde, desde + PAGINA - 1);
    if (error) {
      // Tabla que no existe en esta base (migración sin correr): se omite.
      if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) return [];
      return { error: "No se pudo leer esta tabla." };
    }
    filas.push(...((data ?? []) as Filas));
    if (!data || data.length < PAGINA || !conId) break;
  }
  return filas;
}

/**
 * Descarga de "mis datos" (derecho de acceso): un JSON con todas las filas
 * de la cuenta en las dos apps. Usa la sesión de quien pide (RLS), así que
 * solo puede leer lo propio; además filtra por su id.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });

  // Freno: cada descarga lee todas las tablas. La service role se usa SOLO
  // para la tabla de intentos (sin políticas); los datos se leen con la
  // sesión de quien pide.
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ message: "Falta configurar el servidor (service role)." }, { status: 500 });
  }
  const clave = createHash("sha256").update(`exportar:${user.id}`).digest("hex").slice(0, 32);
  const { count, error: errLimite } = await admin
    .from("intentos_ingreso")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", clave)
    .gte("created_at", new Date(Date.now() - VENTANA_MS).toISOString());
  if (!errLimite && (count ?? 0) >= MAX_DESCARGAS) {
    return NextResponse.json({ message: "Ya descargaste tus datos varias veces. Esperá unos minutos y probá de nuevo." }, { status: 429 });
  }
  await admin.from("intentos_ingreso").insert({ ip_hash: clave });

  const { data: perfil } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  const datos: Record<string, Record<string, Filas | { error: string }>> = { finanzas: {}, empresas: {}, cuenta: {} };
  for (const t of TABLAS) {
    datos[t.app][t.tabla] = await leerTodo(supabase, t.tabla, "user_id", [user.id], t.id);
  }
  // Columnas y filas de los trackers: cuelgan del tracker, no del usuario.
  const trackers = datos.finanzas.trackers;
  const ids = Array.isArray(trackers) ? trackers.map((t) => String(t.id)) : [];
  for (const tabla of ["tracker_columns", "tracker_rows"]) {
    const filas: Filas = [];
    for (let i = 0; i < ids.length; i += 100) {
      const r = await leerTodo(supabase, tabla, "tracker_id", ids.slice(i, i + 100), true);
      if (!Array.isArray(r)) {
        datos.finanzas[tabla] = r;
        break;
      }
      filas.push(...r);
    }
    if (!datos.finanzas[tabla]) datos.finanzas[tabla] = filas;
  }

  // Lista de archivos subidos (solo rutas, no su contenido), leída con la
  // sesión del usuario: las políticas de Storage limitan a su carpeta.
  let archivosStorage: string[] | { error: string };
  try {
    archivosStorage = await listarArchivos(supabase, BUCKET_ARCHIVOS_EMPRESAS, user.id);
  } catch {
    archivosStorage = { error: "No se pudo listar los archivos subidos." };
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const cuerpo = {
    exportado_el: new Date().toISOString(),
    aviso:
      "Copia de los datos de tu cuenta NODOS (nodoscompliance.com, NODOS Finanzas y NODOS Empresas). Los archivos subidos al Archivo de Empresas no se incluyen: se descargan uno por uno desde la app (acá figura su lista).",
    cuenta: {
      id: user.id,
      email: user.email ?? null,
      creada_el: user.created_at,
      ultimo_ingreso: user.last_sign_in_at ?? null,
      perfil: perfil ?? null,
    },
    datos,
    archivos_subidos: { bucket: BUCKET_ARCHIVOS_EMPRESAS, rutas: archivosStorage },
  };

  return new NextResponse(JSON.stringify(cuerpo, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="nodos-mis-datos-${hoy}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

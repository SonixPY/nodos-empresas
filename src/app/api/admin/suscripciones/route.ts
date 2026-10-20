import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/nodos/adminApi";
import {
  accesoHasta,
  estadoVisible,
  hoyPy,
  type CuentaSuscripcion,
  type EstadoFila,
  type PlanAdmin,
  type Periodo,
  type Proveedor,
  type ResumenAdmin,
} from "@/lib/nodos/suscripciones";

const sinCache = { "Cache-Control": "no-store" };

/**
 * Lista para NODOS Panel → Suscripciones. Se lee con la sesión del admin
 * (políticas "admin ve todo" de la migración 011), sin service role.
 */
export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ message: check.message }, { status: check.status, headers: sinCache });

  const supabase = await createSupabaseServerClient();
  const hoy = hoyPy();
  const inicioMes = `${hoy.slice(0, 7)}-01`;

  const [perfiles, subs, planes, pagos] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, nombre, usuario, is_admin, suspendido, acceso_cortesia_hasta")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("suscripciones").select("user_id, plan_id, periodo, estado, proveedor, prueba_hasta, activa_hasta").limit(5000),
    supabase
      .from("planes")
      // Con "*" los beneficios (migración 013/027) aparecen solos cuando existen.
      .select("*")
      .order("orden"),
    supabase.from("pagos").select("monto, moneda, reembolsado").eq("estado", "pagado").gte("fecha_pago", inicioMes).limit(10000),
  ]);

  const error = perfiles.error ?? subs.error ?? planes.error ?? pagos.error;
  if (error) {
    const pendiente = /column|schema cache|does not exist|relation/i.test(error.message);
    return NextResponse.json(
      { message: pendiente ? "Falta correr la migración 011_suscripciones.sql en Supabase." : "No se pudo leer las suscripciones." },
      { status: 500, headers: sinCache }
    );
  }

  type FilaSub = { user_id: string; plan_id: string; periodo: Periodo | null; estado: EstadoFila; proveedor: Proveedor; prueba_hasta: string | null; activa_hasta: string | null };
  const porCuenta = new Map<string, FilaSub>((subs.data as FilaSub[]).map((s) => [s.user_id, s]));

  const cuentas: CuentaSuscripcion[] = (perfiles.data ?? []).map((p) => {
    const s = porCuenta.get(p.id);
    const fila = s?.estado ?? null;
    return {
      user_id: p.id,
      email: p.email,
      nombre: p.nombre,
      usuario: p.usuario,
      is_admin: !!p.is_admin,
      suspendido: !!p.suspendido,
      cortesia_hasta: p.acceso_cortesia_hasta && p.acceso_cortesia_hasta >= hoy ? p.acceso_cortesia_hasta : null,
      plan_id: s?.plan_id ?? null,
      periodo: s?.periodo ?? null,
      estado_fila: fila,
      estado: estadoVisible(fila, s?.prueba_hasta ?? null, s?.activa_hasta ?? null, hoy),
      proveedor: s?.proveedor ?? null,
      prueba_hasta: s?.prueba_hasta ?? null,
      activa_hasta: s?.activa_hasta ?? null,
      acceso_hasta: s ? accesoHasta(fila, s.prueba_hasta, s.activa_hasta) : null,
    };
  });

  const totales = new Map<string, { moneda: string; monto: number; pagos: number }>();
  for (const p of pagos.data ?? []) {
    const t = totales.get(p.moneda) ?? { moneda: p.moneda, monto: 0, pagos: 0 };
    t.monto += Number(p.monto) - Number(p.reembolsado ?? 0);
    t.pagos += 1;
    totales.set(p.moneda, t);
  }

  const cuerpo: ResumenAdmin = {
    cuentas,
    planes: (planes.data ?? []).map((p) => ({
      ...p,
      precio_mensual_gs: Number(p.precio_mensual_gs),
      precio_anual_gs: Number(p.precio_anual_gs),
    })) as PlanAdmin[],
    totales_mes: [...totales.values()],
    hoy,
  };
  return NextResponse.json(cuerpo, { headers: sinCache });
}

"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarPlus, FileText, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { generarCalendarioSeprelad, guardarPerfilSeprelad, useEmpresas, useObligaciones, usePerfilSeprelad } from "@/lib/data";
import {
  EVENTOS_SEPRELAD,
  PRINCIPIOS,
  SECTORES,
  obligacionPorEvento,
  perfilVacio,
  reglasAplicables,
  type PerfilSeprelad,
  type Sector,
} from "@/lib/seprelad";
import { PLANTILLAS, grupoDe } from "@/lib/plantillas";
import { todayIso } from "@/lib/dates";
import { useToast } from "@/components/ToastProvider";
import ObligacionesLista, { aplicarCambio } from "@/components/ObligacionesLista";
import { SkeletonBlock } from "@/components/Skeleton";
import type { Empresa, Obligacion } from "@/lib/types";

function PerfilForm({ empresa, inicial, onSaved }: { empresa: Empresa; inicial: PerfilSeprelad; onSaved: (p: PerfilSeprelad) => void }) {
  const { showToast } = useToast();
  const [p, setP] = useState<PerfilSeprelad>(inicial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof PerfilSeprelad>(k: K, val: PerfilSeprelad[K]) => setP((prev) => ({ ...prev, [k]: val }));
  const toggleSector = (s: Sector) =>
    set("sectores", p.sectores.includes(s) ? p.sectores.filter((x) => x !== s) : [...p.sectores, s]);

  async function guardar() {
    setSaving(true);
    const limpio: PerfilSeprelad = {
      ...p,
      segmento_osfl: p.sectores.includes("osfl") ? p.segmento_osfl : null,
      oc_nombre: p.oc_nombre?.trim() || null,
      oc_cargo: p.oc_cargo?.trim() || null,
      oc_email: p.oc_email?.trim() || null,
      notas: p.notas?.trim() || null,
    };
    const { data, error } = await guardarPerfilSeprelad(limpio);
    setSaving(false);
    if (error) return showToast(`No se pudo guardar: ${error.message}`, "error");
    showToast("Perfil SEPRELAD guardado.");
    onSaved(data as PerfilSeprelad);
  }

  const fecha = (k: "fecha_inscripcion" | "oc_designado_el" | "ultima_autoevaluacion" | "ultima_metodologia") => (
    <input type="date" className="input" value={p[k] ?? ""} onChange={(e) => set(k, e.target.value || null)} />
  );

  return (
    <div className="card">
      <h2>¿{empresa.denominacion} es sujeto obligado?</h2>
      <p className="mt-1 text-sm text-carbon/65">
        Solo si su actividad encaja en el art. 13 de la Ley 1015/97. Marcá los sectores que correspondan; si no marcás
        ninguno, la empresa no tiene obligaciones SEPRELAD en esta app.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {(Object.keys(SECTORES) as Sector[]).map((s) => {
          const on = p.sectores.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleSector(s)}
              className={`rounded-lg border p-3 text-left transition ${on ? "border-cobre bg-cobre/5" : "border-[var(--line)] bg-white hover:border-cobre/50"}`}
            >
              <span className="flex items-center gap-2 font-medium text-musgo">
                <span className={`inline-block h-4 w-4 rounded-sm border ${on ? "border-cobre bg-cobre" : "border-carbon/30"}`} />
                {SECTORES[s].label}
              </span>
              <span className="t-caption mt-1 block text-cobre-hover">{SECTORES[s].norma}</span>
              <span className="mt-1 block text-xs leading-snug text-carbon/60">{SECTORES[s].alcance}</span>
            </button>
          );
        })}
      </div>

      {p.sectores.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {p.sectores.includes("osfl") && (
            <div>
              <label className="field-label">Segmento OSFL asignado</label>
              <select
                className="input"
                value={p.segmento_osfl ?? ""}
                onChange={(e) => set("segmento_osfl", e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Todavía no lo sé</option>
                <option value="1">Segmento 1</option>
                <option value="2">Segmento 2</option>
                <option value="3">Segmento 3</option>
              </select>
            </div>
          )}
          <div>
            <label className="field-label">¿Inscripta en SEPRELAD (SIRO)?</label>
            <select className="input" value={p.inscripta ? "si" : "no"} onChange={(e) => set("inscripta", e.target.value === "si")}>
              <option value="no">No / en trámite</option>
              <option value="si">Sí</option>
            </select>
          </div>
          <div>
            <label className="field-label">Fecha de inscripción</label>
            {fecha("fecha_inscripcion")}
          </div>
          <div>
            <label className="field-label">Oficial de cumplimiento</label>
            <input className="input" value={p.oc_nombre ?? ""} onChange={(e) => set("oc_nombre", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Cargo del oficial</label>
            <input className="input" value={p.oc_cargo ?? ""} onChange={(e) => set("oc_cargo", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Email del oficial</label>
            <input type="email" className="input" value={p.oc_email ?? ""} onChange={(e) => set("oc_email", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Designado el</label>
            {fecha("oc_designado_el")}
          </div>
          <div>
            <label className="field-label">Última autoevaluación de riesgos</label>
            {fecha("ultima_autoevaluacion")}
          </div>
          <div>
            <label className="field-label">Última revisión de metodología</label>
            {fecha("ultima_metodologia")}
          </div>
        </div>
      )}
      <p className="t-caption mt-4 text-carbon/50">
        Por seguridad acá solo se guardan nombre, cargo y email del oficial. Documento, domicilio y CV van solo en la
        nota a SEPRELAD.
      </p>
      <button type="button" className="btn btn-primary mt-4" disabled={saving} onClick={guardar}>
        {saving ? "Guardando..." : "Guardar perfil"}
      </button>
    </div>
  );
}

function CumplimientoContenido() {
  const params = useSearchParams();
  const { showToast } = useToast();
  const empresas = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string | null>(params.get("empresa"));
  const empresa = empresas.data.find((e) => e.id === empresaId) ?? empresas.data[0] ?? null;
  const perfilQ = usePerfilSeprelad(empresa?.id ?? null);
  const obligaciones = useObligaciones(empresa?.id ?? null);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [generando, setGenerando] = useState(false);
  const [evento, setEvento] = useState("");
  const [fechaEvento, setFechaEvento] = useState(todayIso());
  const [detalleEvento, setDetalleEvento] = useState("");

  const migracionPendiente = !!perfilQ.error && /perfil_seprelad|relation|schema cache/i.test(perfilQ.error);
  const perfil = empresa ? (perfilQ.data ?? perfilVacio(empresa.id)) : null;
  const reglas = useMemo(() => (perfil ? reglasAplicables(perfil) : []), [perfil]);
  const eventos = EVENTOS_SEPRELAD.filter((e) => perfil?.sectores.some((s) => e.sectores.includes(s)));
  const deSeprelad = obligaciones.data.filter((o) => o.categoria === "seprelad");
  const pendientes = deSeprelad.filter((o) => o.estado === "pendiente");
  const plantillasSep = PLANTILLAS.filter((p) => grupoDe(p) === "seprelad");

  async function generar() {
    if (!empresa || !perfil) return;
    setGenerando(true);
    const { nuevas, error } = await generarCalendarioSeprelad(empresa, perfil, anio);
    setGenerando(false);
    if (error) return showToast(`No se pudo generar: ${error}`, "error");
    showToast(nuevas ? `Se agregaron ${nuevas} vencimientos SEPRELAD de ${anio}.` : `El calendario SEPRELAD de ${anio} ya estaba al día.`);
    obligaciones.reload();
  }

  async function registrarEvento(e: React.FormEvent) {
    e.preventDefault();
    const ev = EVENTOS_SEPRELAD.find((x) => x.key === evento);
    if (!ev || !empresa) return;
    const fila = obligacionPorEvento(empresa.id, ev, fechaEvento, detalleEvento.trim());
    const { error } = await supabase.from("obligaciones").insert(fila);
    if (error) return showToast(`No se pudo registrar: ${error.message}`, "error");
    showToast(`Listo: vence el ${fila.fecha.split("-").reverse().join("/")}.`);
    setEvento("");
    setDetalleEvento("");
    obligaciones.reload();
  }

  if (empresas.loading) return <SkeletonBlock className="h-64" />;
  if (!empresa || !perfil) {
    return (
      <div className="card text-carbon/70">
        Primero cargá una empresa en{" "}
        <Link href="/empresas" className="text-cobre-hover underline">
          Empresas
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {empresas.data.length > 1 && (
        <select className="input w-auto" value={empresa.id} onChange={(e) => setEmpresaId(e.target.value)}>
          {empresas.data.map((e) => (
            <option key={e.id} value={e.id}>
              {e.denominacion}
            </option>
          ))}
        </select>
      )}

      {migracionPendiente ? (
        <div className="card flex gap-3 border-cobre/40 bg-cobre/5 text-sm">
          <AlertTriangle size={18} className="shrink-0 text-cobre" />
          <p>
            El módulo SEPRELAD necesita la migración <code>002_seprelad.sql</code> en Supabase. Cuando corra, esta
            pantalla se habilita sola.
          </p>
        </div>
      ) : perfilQ.loading ? (
        <SkeletonBlock className="h-48" />
      ) : (
        <PerfilForm key={`${empresa.id}:${perfilQ.data ? "ok" : "nuevo"}`} empresa={empresa} inicial={perfil} onSaved={(p) => perfilQ.setData(p)} />
      )}

      {perfil.sectores.length > 0 && !migracionPendiente && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2>Qué te toca en el año</h2>
                <div className="flex items-center gap-2">
                  <select className="input w-auto py-1.5" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                    {[anio - 1, anio, anio + 1].map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-primary" disabled={generando || !perfilQ.data} onClick={generar}>
                    <CalendarPlus size={15} /> {generando ? "Generando..." : "Generar calendario"}
                  </button>
                </div>
              </div>
              {!perfilQ.data && <p className="t-caption mt-2 text-cobre-hover">Guardá el perfil para poder generar el calendario.</p>}
              <ul className="mt-4 divide-y divide-[var(--line)]">
                {reglas.map((r) => (
                  <li key={r.regla} className="py-2.5">
                    <p className="font-medium text-musgo">
                      {r.titulo}
                      {r.sugerida && <span className="t-caption ml-2 rounded-sm bg-marfil px-1.5 py-0.5 text-carbon/60">fecha sugerida</span>}
                      {r.verificar && <span className="t-caption ml-2 rounded-sm bg-cobre/10 px-1.5 py-0.5 text-cobre-hover">verificar</span>}
                    </p>
                    <p className="text-sm text-carbon/65">{r.descripcion}</p>
                    <p className="t-caption mt-0.5 text-carbon/45">{r.base}</p>
                  </li>
                ))}
                {reglas.length === 0 && <li className="py-3 text-sm text-carbon/60">Elegí el segmento OSFL para ver sus obligaciones.</li>}
              </ul>
            </div>

            <div className="space-y-6">
              <form onSubmit={registrarEvento} className="card">
                <h2>Registrar un hecho</h2>
                <p className="mt-1 text-sm text-carbon/65">Algunos plazos corren desde un hecho puntual. Cargalo y el vencimiento se crea solo.</p>
                <label className="field-label mt-4">¿Qué pasó?</label>
                <select className="input" value={evento} onChange={(e) => setEvento(e.target.value)} required>
                  <option value="">Elegí un hecho</option>
                  {eventos.map((ev) => (
                    <option key={ev.key} value={ev.key}>
                      {ev.label} ({ev.plazoTexto})
                    </option>
                  ))}
                </select>
                <label className="field-label mt-3">Fecha del hecho</label>
                <input type="date" className="input" value={fechaEvento} onChange={(e) => setFechaEvento(e.target.value)} required />
                <label className="field-label mt-3">Detalle (opcional)</label>
                <input className="input" value={detalleEvento} onChange={(e) => setDetalleEvento(e.target.value)} placeholder="Sin datos de clientes" />
                <button type="submit" className="btn btn-primary mt-4" disabled={!evento}>
                  Crear vencimiento
                </button>
              </form>

              <div className="card">
                <h2>Documentos</h2>
                <ul className="mt-3 space-y-1.5">
                  {plantillasSep.map((p) => (
                    <li key={p.key}>
                      <Link
                        href={`/documentos?empresa=${empresa.id}&plantilla=${p.key}`}
                        className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-marfil"
                      >
                        <FileText size={15} className="mt-0.5 shrink-0 text-cobre" />
                        <span>
                          <span className="font-medium text-musgo">{p.numero} · {p.titulo}</span>
                          <span className="block text-xs text-carbon/55">{p.descripcion}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <section>
            <h2 className="mb-3">
              Vencimientos SEPRELAD <span className="font-sans text-sm font-normal text-carbon/50">· {pendientes.length} pendientes</span>
            </h2>
            <ObligacionesLista
              obligaciones={deSeprelad}
              onChange={(id, patch) => obligaciones.setData((prev: Obligacion[]) => aplicarCambio(prev, id, patch))}
              vacio="Todavía no generaste el calendario SEPRELAD de este año."
            />
          </section>
        </>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PRINCIPIOS.map((pr) => (
          <div key={pr.titulo} className="rounded-lg border border-[var(--line)] bg-white p-4">
            <p className="flex items-center gap-2 font-medium text-musgo">
              <ShieldCheck size={15} className="text-cobre" /> {pr.titulo}
            </p>
            <p className="mt-1 text-sm text-carbon/65">{pr.texto}</p>
            <p className="t-caption mt-1 text-carbon/45">{pr.base}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function CumplimientoPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="t-caption uppercase tracking-[0.14em] text-cobre-hover">PLA/FT · Ley 1015/97</p>
        <h1 className="mt-1">Cumplimiento SEPRELAD</h1>
        <p className="mt-1 max-w-3xl text-carbon/65">
          Para empresas que son sujetos obligados: inmobiliarias y desarrolladoras, fundaciones familiares y
          remesadoras. Vencimientos, hechos con plazo y documentos base, con la resolución que corresponde a cada uno.
        </p>
      </header>
      <Suspense fallback={null}>
        <CumplimientoContenido />
      </Suspense>
      <p className="t-caption mt-10 max-w-3xl text-carbon/50">
        Herramienta de organización e información. No constituye asesoramiento legal personalizado ni reemplaza la
        revisión de un profesional. Las fechas son referencias: SEPRELAD puede prorrogar plazos y los feriados
        trasladables no se descuentan. Lo marcado &quot;verificar&quot; debe confirmarse con el texto oficial.
      </p>
    </main>
  );
}

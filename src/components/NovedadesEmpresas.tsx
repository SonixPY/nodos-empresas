"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, MessageCircle, Newspaper, RotateCw, Star } from "lucide-react";
import { useNotasNodos, useSectoresSeprelad } from "@/lib/data";
import { useNovedades, type EstadoNovedades } from "@/lib/useNovedades";
import {
  contextoEmpresa,
  DISCLAIMER_NOVEDADES,
  empresasAfectadas,
  empresasDeNota,
  notaVisible,
  temaPorId,
  temasParaEmpresas,
  tiempoRelativo,
  urlSegura,
  type EmpresaCtx,
  type Novedad,
  type NotaNodos,
} from "@/lib/novedades";
import type { Empresa } from "@/lib/types";
import type { EmpresaSiara } from "@/lib/siara";

type Pestana = "normativa" | "rubro" | "notas";

export interface FuenteNovedades {
  estado: EstadoNovedades;
  items: Novedad[];
  ahora: number;
  reintentar?: () => void;
}

export type ResultadoConsulta = { ok: true; repetida?: boolean } | { ok: false; message: string };

/** Envía la consulta de una nota. Solo se llama después de la confirmación explícita. */
async function enviarConsulta(nota: NotaNodos): Promise<ResultadoConsulta> {
  try {
    const res = await fetch("/api/novedades/consulta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ notaId: nota.id, confirmado: true }),
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string; repetida?: boolean };
    if (!res.ok) return { ok: false, message: body.message ?? "No pudimos enviar la consulta. Probá de nuevo." };
    return { ok: true, repetida: body.repetida };
  } catch {
    return { ok: false, message: "Sin conexión. Probá de nuevo en un rato." };
  }
}

/**
 * Bloque "Novedades para tus empresas". Carga los sectores SEPRELAD y las
 * notas con RLS, decide los temas EN EL NAVEGADOR y le pide al servidor solo
 * los ids de esos temas. Con `compacta` (ficha de una empresa) muestra menos
 * y sin chips de empresa.
 */
export default function NovedadesEmpresas({
  empresas,
  loading = false,
  compacta = false,
}: {
  empresas: Empresa[];
  loading?: boolean;
  compacta?: boolean;
}) {
  const sectores = useSectoresSeprelad();
  const notas = useNotasNodos();

  const ctxs = useMemo<EmpresaCtx[]>(() => {
    const porEmpresa = new Map(sectores.data.map((p) => [p.empresa_id, p.sectores ?? []]));
    return empresas.map((e) => contextoEmpresa(e as EmpresaSiara, porEmpresa.get(e.id) ?? []));
  }, [empresas, sectores.data]);

  const listo = !loading && !sectores.loading;
  const idsNormativa = useMemo(() => temasParaEmpresas("normativa", ctxs).map((t) => t.id), [ctxs]);
  const idsRubro = useMemo(() => temasParaEmpresas("rubro", ctxs).map((t) => t.id), [ctxs]);
  const normativa = useNovedades(idsNormativa, listo);
  const rubro = useNovedades(idsRubro, listo);

  return (
    <NovedadesVista
      empresas={ctxs}
      normativa={normativa}
      rubro={rubro}
      // Si la tabla todavía no existe (falta correr 008), las notas quedan vacías sin error.
      notas={notas.data}
      notasCargando={notas.loading}
      compacta={compacta}
      onConsultar={enviarConsulta}
    />
  );
}

const pillClass = (activo: boolean) =>
  `shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
    activo ? "border-musgo bg-musgo text-marfil" : "border-[var(--line)] bg-white text-carbon/70 hover:border-cobre hover:text-carbon"
  }`;

/** Chips "Puede afectar a: …". Si son todas (y más de una), un solo chip. */
function Afectadas({ afectadas, total }: { afectadas: EmpresaCtx[]; total: number }) {
  if (afectadas.length === 0) return null;
  const todas = total > 1 && afectadas.length === total;
  const visibles = todas ? [] : afectadas.slice(0, 3);
  const resto = todas ? 0 : afectadas.length - visibles.length;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-carbon/55">
      <span>Puede afectar a:</span>
      {todas ? (
        <span className="rounded-full bg-marfil px-2 py-0.5 font-medium text-carbon/75">Todas tus empresas</span>
      ) : (
        visibles.map((e) => (
          <span key={e.id} className="max-w-[14rem] truncate rounded-full bg-marfil px-2 py-0.5 font-medium text-carbon/75" title={e.nombre}>
            {e.nombre}
          </span>
        ))
      )}
      {resto > 0 && <span className="rounded-full bg-marfil px-2 py-0.5 font-medium text-carbon/60">+{resto}</span>}
    </div>
  );
}

function FilaNovedad({ n, ahora, afectadas, total, compacta }: { n: Novedad; ahora: number; afectadas: EmpresaCtx[]; total: number; compacta: boolean }) {
  const url = urlSegura(n.url);
  const rel = tiempoRelativo(n.fecha, ahora);
  const tema = temaPorId(n.tema);
  const contenido = (
    <>
      {n.titulo}
      {url && <ExternalLink size={12} className="ml-1 inline-block align-baseline opacity-50 transition group-hover:opacity-100" aria-hidden="true" />}
    </>
  );
  return (
    <li className="py-3 first:pt-1">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[11px]">
        {tema && <span className="font-semibold uppercase tracking-wider text-cobre-hover">{tema.label}</span>}
        <span className="truncate text-carbon/50">
          {n.fuente || "Google News"}
          {rel ? ` · ${rel}` : ""}
        </span>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          className="group mt-1 block text-sm font-medium leading-snug text-musgo [overflow-wrap:anywhere] hover:underline"
        >
          {contenido}
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      ) : (
        <p className="mt-1 text-sm font-medium leading-snug text-musgo">{contenido}</p>
      )}
      {!compacta && <Afectadas afectadas={afectadas} total={total} />}
    </li>
  );
}

type EstadoConsulta = { paso: "confirmando" } | { paso: "enviando" } | { paso: "enviada"; repetida?: boolean } | { paso: "error"; message: string };

function TarjetaNota({
  nota,
  afectadas,
  total,
  compacta,
  ahora,
  consulta,
  onConsulta,
  onEnviar,
}: {
  nota: NotaNodos;
  afectadas: EmpresaCtx[];
  total: number;
  compacta: boolean;
  ahora: number;
  consulta: EstadoConsulta | undefined;
  onConsulta: (estado: EstadoConsulta | undefined) => void;
  onEnviar: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const link = urlSegura(nota.link);
  const organismo = nota.organismo ? temaPorId(nota.organismo) : undefined;
  const fecha = nota.publicada_el && ahora ? tiempoRelativo(nota.publicada_el, ahora) : "";

  return (
    <li className={`rounded-lg border p-3 sm:p-4 ${nota.destacada ? "border-cobre/50 bg-marfil/70" : "border-[var(--line)] bg-white"}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span className="rounded-full bg-musgo px-2 py-0.5 font-semibold uppercase tracking-wider text-marfil">Nota NODOS</span>
        {nota.destacada && (
          <span className="inline-flex items-center gap-1 font-semibold text-cobre-hover">
            <Star size={11} className="fill-current" aria-hidden="true" /> Destacada
          </span>
        )}
        {organismo && <span className="font-semibold uppercase tracking-wider text-cobre-hover">{organismo.label}</span>}
        {fecha && <span className="text-carbon/50">{fecha}</span>}
      </div>
      <h3 className="mt-1.5 font-display text-base font-semibold leading-snug text-musgo [overflow-wrap:anywhere]">{nota.titulo}</h3>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-carbon/75 [overflow-wrap:anywhere]">{nota.resumen}</p>
      {nota.cuerpo && abierta && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-carbon/75 [overflow-wrap:anywhere]">{nota.cuerpo}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium">
        {nota.cuerpo && (
          <button type="button" className="text-cobre-hover hover:underline" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta}>
            {abierta ? "Ver menos" : "Leer más"}
          </button>
        )}
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex items-center gap-1 text-cobre-hover hover:underline">
            Ver fuente <ExternalLink size={11} aria-hidden="true" />
          </a>
        )}
      </div>
      {!compacta && <Afectadas afectadas={afectadas} total={total} />}

      <div className="mt-3">
        {consulta?.paso === "enviada" ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-good" role="status">
            <Check size={15} /> {consulta.repetida ? "Ya habíamos recibido tu consulta sobre esta nota." : "Listo. Te respondemos a tu email."}
          </p>
        ) : consulta && consulta.paso !== "error" ? (
          <div role="region" aria-label="Confirmar consulta" className="animate-fade-in rounded-md border border-cobre/40 bg-white p-3 text-sm">
            <p className="font-medium text-musgo">¿Enviamos tu consulta?</p>
            <p className="mt-1 text-carbon/75">
              Vamos a enviar tu nombre y email a NODOS para responderte. No enviamos datos de tus empresas.
            </p>
            <p className="mt-1 text-xs text-carbon/55 [overflow-wrap:anywhere]">Mensaje: “Consulta sobre la nota: {nota.titulo}”</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={onEnviar} disabled={consulta.paso === "enviando"}>
                {consulta.paso === "enviando" ? "Enviando..." : "Sí, enviar consulta"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => onConsulta(undefined)} disabled={consulta.paso === "enviando"}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-ghost !py-1.5 text-sm"
              onClick={() => onConsulta({ paso: "confirmando" })}
            >
              <MessageCircle size={14} /> Consultar sobre esto
            </button>
            {consulta?.paso === "error" && (
              <p className="mt-2 text-xs text-bad" role="alert">
                {consulta.message}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/** Vista previa de una nota para el Panel (sin envío de consultas). */
export function NotaPreview({ nota }: { nota: NotaNodos }) {
  return (
    <ul>
      <TarjetaNota nota={nota} afectadas={[]} total={0} compacta ahora={0} consulta={undefined} onConsulta={() => {}} onEnviar={() => {}} />
    </ul>
  );
}

function Cargando({ filas }: { filas: number }) {
  return (
    <ul aria-busy="true" aria-label="Cargando novedades" className="divide-y divide-[var(--line)]">
      {Array.from({ length: filas }, (_, i) => (
        <li key={i} className="py-3">
          <div className="skeleton h-2.5 w-24 rounded" />
          <div className="skeleton mt-2 h-3.5 w-full rounded" />
          <div className="skeleton mt-1.5 h-3.5 w-3/5 rounded" />
        </li>
      ))}
    </ul>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md bg-marfil/70 p-4 text-sm text-carbon/65">{children}</div>;
}

/** Vista sin carga de datos (la usa el bloque y el banco de pruebas). */
export function NovedadesVista({
  empresas,
  normativa,
  rubro,
  notas,
  notasCargando = false,
  compacta = false,
  onConsultar,
}: {
  empresas: EmpresaCtx[];
  normativa: FuenteNovedades;
  rubro: FuenteNovedades;
  notas: NotaNodos[];
  notasCargando?: boolean;
  compacta?: boolean;
  onConsultar: (nota: NotaNodos) => Promise<ResultadoConsulta>;
}) {
  const [pestana, setPestana] = useState<Pestana>("normativa");
  const [filtro, setFiltro] = useState<string | null>(null);
  const [verTodo, setVerTodo] = useState(false);
  const [consultas, setConsultas] = useState<Record<string, EstadoConsulta | undefined>>({});

  const total = empresas.length;
  const filtroVigente = filtro && empresas.some((e) => e.id === filtro) ? filtro : null;
  const enFiltro = (afectadas: EmpresaCtx[]) => !filtroVigente || afectadas.some((e) => e.id === filtroVigente);

  // Con empresas cargadas, solo titulares de temas que le aplican a alguna.
  const conAfectadas = (f: FuenteNovedades) =>
    f.items
      .map((n) => ({ n, afectadas: empresasAfectadas(n.tema, empresas) }))
      .filter((x) => (total === 0 || x.afectadas.length > 0) && enFiltro(x.afectadas));
  const listaNormativa = conAfectadas(normativa);
  const listaRubro = conAfectadas(rubro);
  const listaNotas = notas
    .filter((n) => n.publicada && notaVisible(n, empresas))
    .map((n) => ({ n, afectadas: empresasDeNota(n, empresas) }))
    .filter((x) => enFiltro(x.afectadas))
    .sort((a, b) => Number(b.n.destacada) - Number(a.n.destacada) || (b.n.publicada_el ?? "").localeCompare(a.n.publicada_el ?? ""));
  const destacadas = listaNotas.filter((x) => x.n.destacada).slice(0, compacta ? 1 : 2);
  const sinRubro = empresas.length > 0 && empresas.every((e) => e.rubro === null);
  const primeraSinRubro = empresas.find((e) => e.rubro === null || e.rubroEstimado);

  const limite = verTodo ? Infinity : compacta ? 3 : 5;
  const ahora = normativa.ahora || rubro.ahora;

  async function enviar(nota: NotaNodos) {
    setConsultas((c) => ({ ...c, [nota.id]: { paso: "enviando" } }));
    const r = await onConsultar(nota);
    setConsultas((c) => ({ ...c, [nota.id]: r.ok ? { paso: "enviada", repetida: r.repetida } : { paso: "error", message: r.message } }));
  }

  const tarjeta = ({ n, afectadas }: { n: NotaNodos; afectadas: EmpresaCtx[] }) => (
    <TarjetaNota
      key={n.id}
      nota={n}
      afectadas={afectadas}
      total={total}
      compacta={compacta}
      ahora={ahora}
      consulta={consultas[n.id]}
      onConsulta={(estado) => setConsultas((c) => ({ ...c, [n.id]: estado }))}
      onEnviar={() => enviar(n)}
    />
  );

  function listaAutomatica(f: FuenteNovedades, lista: { n: Novedad; afectadas: EmpresaCtx[] }[], vacio: React.ReactNode) {
    if (f.estado === "cargando") return <Cargando filas={compacta ? 2 : 3} />;
    if (f.estado === "error")
      return (
        <Aviso>
          No pudimos traer las novedades en este momento.{" "}
          {f.reintentar && (
            <button type="button" onClick={f.reintentar} className="inline-flex items-center gap-1 font-medium text-cobre-hover hover:underline">
              <RotateCw size={13} /> Reintentar
            </button>
          )}
        </Aviso>
      );
    if (lista.length === 0) return <Aviso>{vacio}</Aviso>;
    return (
      <>
        <ul className="divide-y divide-[var(--line)]">
          {lista.slice(0, limite).map(({ n, afectadas }) => (
            <FilaNovedad key={n.url} n={n} ahora={f.ahora} afectadas={afectadas} total={total} compacta={compacta} />
          ))}
        </ul>
        {lista.length > limite && (
          <button type="button" className="mt-1 text-xs font-medium text-cobre-hover hover:underline" onClick={() => setVerTodo(true)}>
            Ver {lista.length - limite} más
          </button>
        )}
      </>
    );
  }

  const cuenta = (f: FuenteNovedades, n: number) => (f.estado === "ok" ? n : null);
  const pestanas: { id: Pestana; label: React.ReactNode; cantidad: number | null }[] = [
    { id: "normativa", label: "Normativa", cantidad: cuenta(normativa, listaNormativa.length) },
    { id: "rubro", label: "Tu rubro", cantidad: cuenta(rubro, listaRubro.length) },
    {
      id: "notas",
      label: (
        <>
          Notas<span className="max-[400px]:hidden"> NODOS</span>
        </>
      ),
      cantidad: notasCargando ? null : listaNotas.length,
    },
  ];

  return (
    <section className={`card ${compacta ? "mt-6" : "mb-6"} !p-4 sm:!p-6`} aria-labelledby="novedades-titulo">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="t-caption flex items-center gap-1.5 uppercase tracking-[0.14em] text-cobre-hover">
            <Newspaper size={13} aria-hidden="true" /> Novedades
          </p>
          <h2 id="novedades-titulo" className="mt-0.5">
            {compacta ? "Novedades para esta empresa" : "Novedades para tus empresas"}
          </h2>
        </div>
      </div>

      {pestana !== "notas" && destacadas.length > 0 && <ul className="mt-4 space-y-3">{destacadas.map(tarjeta)}</ul>}

      <div className="mt-4 flex flex-col gap-3">
        <div className="segmented max-sm:!w-full" role="tablist" aria-label="Tipo de novedad">
          {pestanas.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              className={`max-sm:flex-1 ${pestana === p.id ? "active" : ""}`}
              onClick={() => {
                setPestana(p.id);
                setVerTodo(false);
              }}
            >
              {p.label}
              {p.cantidad !== null && <span className="ml-1 text-[11px] tabular-nums opacity-70">{p.cantidad}</span>}
            </button>
          ))}
        </div>

        {!compacta && empresas.length > 1 && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [contain:inline-size]" role="group" aria-label="Filtrar por empresa">
            <button type="button" className={pillClass(!filtroVigente)} aria-pressed={!filtroVigente} onClick={() => setFiltro(null)}>
              Todas
            </button>
            {empresas.map((e) => (
              <button
                key={e.id}
                type="button"
                className={`${pillClass(filtroVigente === e.id)} max-w-[16rem] truncate`}
                aria-pressed={filtroVigente === e.id}
                onClick={() => setFiltro(filtroVigente === e.id ? null : e.id)}
                title={e.nombre}
              >
                {e.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3" role="tabpanel">
        {pestana === "normativa" &&
          listaAutomatica(normativa, listaNormativa, "No hay titulares recientes de los organismos que siguen tus empresas. Volvé a mirar más tarde.")}
        {pestana === "rubro" &&
          (sinRubro ? (
            <Aviso>
              Elegí el rubro de tu empresa para ver noticias de tu sector.{" "}
              {primeraSinRubro && (
                <Link href={`/empresas/${primeraSinRubro.id}?tab=datos`} className="font-medium text-cobre-hover hover:underline">
                  Completar rubro
                </Link>
              )}
            </Aviso>
          ) : (
            <>
              {listaAutomatica(rubro, listaRubro, "No hay titulares recientes de tu rubro. Volvé a mirar más tarde.")}
              {primeraSinRubro && rubro.estado === "ok" && (
                <p className="mt-2 text-[11px] text-carbon/50">
                  {primeraSinRubro.rubroEstimado
                    ? `Estimamos el rubro de ${primeraSinRubro.nombre} por su actividad o su nombre.`
                    : `${primeraSinRubro.nombre} no tiene rubro cargado.`}{" "}
                  <Link href={`/empresas/${primeraSinRubro.id}?tab=datos`} className="font-medium text-cobre-hover hover:underline">
                    Elegilo vos
                  </Link>
                </p>
              )}
            </>
          ))}
        {pestana === "notas" &&
          (notasCargando ? (
            <Cargando filas={2} />
          ) : listaNotas.length === 0 ? (
            <Aviso>Todavía no hay notas del equipo NODOS para tus empresas.</Aviso>
          ) : (
            <>
              <ul className="space-y-3">{listaNotas.slice(0, limite).map(tarjeta)}</ul>
              {listaNotas.length > limite && (
                <button type="button" className="mt-2 text-xs font-medium text-cobre-hover hover:underline" onClick={() => setVerTodo(true)}>
                  Ver {listaNotas.length - limite} más
                </button>
              )}
            </>
          ))}
      </div>

      <p className="mt-4 border-t border-[var(--line)] pt-3 text-[11px] leading-snug text-carbon/50">{DISCLAIMER_NOVEDADES}</p>
    </section>
  );
}

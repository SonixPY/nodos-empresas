"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileImage, FileSpreadsheet, FileText, Search, Trash2, UploadCloud, X } from "lucide-react";
import { useEmpresas } from "@/lib/data";
import { formatFecha } from "@/lib/dates";
import {
  ACCEPT_ARCHIVO,
  TIPOS_ARCHIVO,
  TIPO_ARCHIVO_LABEL,
  claveSegura,
  eliminarArchivo,
  extensionDe,
  formatTamano,
  nombreLibre,
  subirArchivo,
  tituloDocumento,
  urlDescarga,
  useArchivos,
  validarArchivo,
  type Archivo,
  type TipoArchivo,
} from "@/lib/archivo";
import { useToast } from "@/components/ToastProvider";
import { SkeletonTable } from "@/components/Skeleton";
import type { Empresa } from "@/lib/types";

function IconoArchivo({ mime }: { mime: string | null }) {
  const cls = "shrink-0 text-cobre";
  if (mime?.startsWith("image/")) return <FileImage size={18} className={cls} />;
  if (mime?.includes("sheet") || mime?.includes("excel")) return <FileSpreadsheet size={18} className={cls} />;
  return <FileText size={18} className={cls} />;
}

// ─── subida ──────────────────────────────────────────────────────────────

function Subida({
  empresas,
  empresaFija,
  existentes,
  onSubido,
}: {
  empresas: Empresa[];
  empresaFija: string | null;
  existentes: Archivo[];
  onSubido: (a: Archivo) => void;
}) {
  const { showToast } = useToast();
  const [empresaId, setEmpresaId] = useState(empresaFija ?? "");
  const [tipo, setTipo] = useState<TipoArchivo | "">("");
  const [detalle, setDetalle] = useState("");
  const [fecha, setFecha] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const empresa = empresas.find((e) => e.id === (empresaFija ?? empresaId)) ?? null;
  const faltan = [!empresa && "empresa", !tipo && "tipo de documento", !fecha && "fecha del documento", !file && "archivo"].filter(
    Boolean,
  ) as string[];

  const nombre = useMemo(() => {
    if (!empresa || !tipo || !fecha) return null;
    const ext = file ? extensionDe(file.name) : "pdf";
    const ocupados = new Set(
      existentes.filter((a) => a.empresa_id === empresa.id).map((a) => a.storage_path.split("/").pop()!.toLowerCase()),
    );
    return nombreLibre(empresa.denominacion, tituloDocumento(tipo, detalle), fecha, ext, ocupados).nombre;
  }, [empresa, tipo, detalle, fecha, file, existentes]);

  function elegir(f: File | null | undefined) {
    if (!f) return;
    const err = validarArchivo(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  }

  async function subir() {
    if (!empresa || !tipo || !fecha || !file) {
      setError(`Falta: ${faltan.join(", ")}.`);
      return;
    }
    setSubiendo(true);
    setError(null);
    const { data, error: err } = await subirArchivo({ empresa, tipo, detalle, fecha, file, existentes });
    setSubiendo(false);
    if (err || !data) {
      setError(`No se pudo subir: ${err ?? "error desconocido"}`);
      return;
    }
    showToast(`Guardado como “${data.nombre_archivo}”.`);
    setFile(null);
    setDetalle("");
    if (inputRef.current) inputRef.current.value = "";
    onSubido(data);
  }

  return (
    <div
      className="card space-y-3"
      onDragOver={(e) => {
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastrando(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        elegir(e.dataTransfer.files?.[0]);
      }}
    >
      <div>
        <h3>Subir un documento</h3>
        <p className="mt-0.5 text-xs text-carbon/60">
          Elegí empresa, tipo y fecha: el archivo se renombra solo como <strong>EMPRESA - DOCUMENTO (FECHA)</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!empresaFija && (
          <div>
            <label className="field-label">
              Empresa<span className="required-mark">*</span>
            </label>
            <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              <option value="">Elegí una empresa</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.denominacion}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="field-label">
            Tipo de documento<span className="required-mark">*</span>
          </label>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as TipoArchivo | "")}>
            <option value="">Elegí el tipo</option>
            {TIPOS_ARCHIVO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Detalle (opcional)</label>
          <input
            className="input"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            maxLength={80}
            placeholder={tipo === "acta_asamblea" ? "ordinaria" : tipo === "otro" ? "Nota a la DNIT" : "ej.: ordinaria, 2025"}
          />
        </div>
        <div>
          <label className="field-label">
            Fecha del documento<span className="required-mark">*</span>
          </label>
          <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed px-4 py-6 text-center transition"
        style={{
          borderColor: arrastrando ? "var(--color-cobre)" : "var(--line)",
          background: arrastrando ? "rgba(184,115,74,0.07)" : "rgba(242,238,230,0.45)",
        }}
      >
        <UploadCloud size={22} className="text-cobre" />
        <span className="text-sm text-carbon/80">
          <span className="hidden sm:inline">Arrastrá el archivo acá o </span>
          <span className="font-medium text-cobre-hover underline">
            <span className="sm:hidden">Elegí el archivo</span>
            <span className="hidden sm:inline">elegilo desde tu equipo</span>
          </span>
        </span>
        <span className="text-[11px] text-carbon/50">PDF, JPG, PNG, WEBP, Word o Excel · hasta 20 MB</span>
      </button>
      <input ref={inputRef} type="file" accept={ACCEPT_ARCHIVO} className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />

      {file && (
        <div className="flex items-center gap-2 rounded-sm border bg-white px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
          <IconoArchivo mime={file.type} />
          <span className="min-w-0 flex-1 truncate text-carbon/80" title={file.name}>
            {file.name}
          </span>
          <span className="shrink-0 text-xs text-carbon/50">{formatTamano(file.size)}</span>
          <button
            type="button"
            className="rounded-full p-1 text-carbon/45 hover:text-bad"
            title="Quitar"
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="rounded-sm border px-3 py-2" style={{ borderColor: "rgba(184,115,74,0.35)", background: "rgba(184,115,74,0.05)" }}>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-cobre-hover">Se guardará como</p>
        {nombre ? (
          <p className="mt-0.5 font-mono [overflow-wrap:anywhere] text-[13px] text-carbon">{file ? nombre : nombre.replace(/\.pdf$/, ".…")}</p>
        ) : (
          <p className="mt-0.5 text-[13px] text-carbon/55">Completá empresa, tipo y fecha para ver el nombre final.</p>
        )}
      </div>

      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={subir} disabled={subiendo || faltan.length > 0}>
          {subiendo ? (
            <>
              <span className="spinner" /> Subiendo{file ? ` ${formatTamano(file.size)}` : ""}…
            </>
          ) : (
            <>
              <UploadCloud size={15} /> Subir archivo
            </>
          )}
        </button>
        {faltan.length > 0 && !subiendo && <span className="text-xs text-carbon/55">Falta: {faltan.join(", ")}.</span>}
      </div>
    </div>
  );
}

// ─── fila ────────────────────────────────────────────────────────────────

function FilaArchivo({ a, empresa, onBorrado }: { a: Archivo; empresa?: string; onBorrado: () => void }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<"bajando" | "borrando" | null>(null);

  async function descargar() {
    setBusy("bajando");
    const { url, error } = await urlDescarga(a);
    setBusy(null);
    if (!url) return showToast(`No se pudo descargar: ${error ?? "sin enlace"}`, "error");
    const link = document.createElement("a");
    link.href = url;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function borrar() {
    if (!confirm(`¿Eliminar “${a.nombre_archivo}”? Se borra el archivo y no se puede recuperar.`)) return;
    setBusy("borrando");
    const { error } = await eliminarArchivo(a);
    setBusy(null);
    if (error) return showToast(`No se pudo eliminar: ${error}`, "error");
    showToast("Archivo eliminado.");
    onBorrado();
  }

  return (
    <li className="flex items-start gap-3 px-3 py-2.5 sm:items-center">
      <IconoArchivo mime={a.mime} />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium text-carbon sm:truncate" title={a.nombre_archivo}>
          {a.nombre_archivo}
        </p>
        <p className="text-xs text-carbon/55">
          {formatFecha(a.fecha_documento)} · {formatTamano(a.tamano)}
          {empresa ? ` · ${empresa}` : ""} · subido el {formatFecha(a.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          className="rounded-full p-1.5 text-carbon/55 transition hover:bg-cobre/10 hover:text-cobre-hover disabled:opacity-50"
          title="Descargar"
          onClick={descargar}
          disabled={busy !== null}
        >
          {busy === "bajando" ? <span className="spinner" /> : <Download size={16} />}
        </button>
        <button
          type="button"
          className="rounded-full p-1.5 text-carbon/45 transition hover:text-bad disabled:opacity-50"
          title="Eliminar"
          onClick={borrar}
          disabled={busy !== null}
        >
          {busy === "borrando" ? <span className="spinner" /> : <Trash2 size={16} />}
        </button>
      </div>
    </li>
  );
}

// ─── panel ───────────────────────────────────────────────────────────────

/**
 * Archivo de documentos reales. Con `empresaId` muestra y sube solo los de
 * esa empresa; sin él, los de todas, con filtro por empresa.
 */
export default function ArchivoPanel({
  empresaId = null,
  empresas: empresasProp,
  empresaInicial = null,
}: {
  empresaId?: string | null;
  empresas?: Empresa[];
  /** Filtro de empresa inicial en la vista global. */
  empresaInicial?: string | null;
}) {
  const empresasQ = useEmpresas();
  const empresas = empresasProp ?? empresasQ.data;
  const archivos = useArchivos(empresaId);
  const [busqueda, setBusqueda] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"" | TipoArchivo>("");
  const [empresaFiltro, setEmpresaFiltro] = useState(empresaInicial ?? "");
  const [orden, setOrden] = useState<"tipo" | "fecha">("tipo");
  const global = !empresaId;
  const nombres = useMemo(() => new Map(empresas.map((e) => [e.id, e.denominacion])), [empresas]);

  const q = claveSegura(busqueda.trim()).toLowerCase();
  const filtrados = archivos.data.filter(
    (a) =>
      (!empresaFiltro || a.empresa_id === empresaFiltro) &&
      (!tipoFiltro || a.tipo_documento === tipoFiltro) &&
      (!q ||
        claveSegura(`${a.nombre_archivo} ${a.detalle ?? ""}`)
          .toLowerCase()
          .includes(q)),
  );
  const porFecha = [...filtrados].sort(
    (x, y) => y.fecha_documento.localeCompare(x.fecha_documento) || y.created_at.localeCompare(x.created_at),
  );
  const grupos = TIPOS_ARCHIVO.map((t) => ({ tipo: t.value, items: porFecha.filter((a) => a.tipo_documento === t.value) })).filter(
    (g) => g.items.length > 0,
  );

  const quitar = (id: string) => archivos.setData((prev) => prev.filter((x) => x.id !== id));

  return (
    <section className="space-y-4">
      <div>
        <h2>Archivo</h2>
        <p className="mt-0.5 text-sm text-carbon/60">
          Estatutos, actas, constancias y demás documentos reales {global ? "de tus empresas" : "de la empresa"}, con nombres uniformes y en
          un lugar privado.
        </p>
      </div>

      {empresas.length === 0 && !empresasQ.loading ? (
        <div className="card text-sm text-carbon/70">Para subir documentos primero cargá una empresa.</div>
      ) : (
        <Subida
          key={empresaId ?? "global"}
          empresas={empresas}
          empresaFija={empresaId}
          existentes={archivos.data}
          onSubido={(a) => archivos.setData((prev) => [a, ...prev])}
        />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="segmented" aria-label="Ordenar">
          <button type="button" className={orden === "tipo" ? "active" : ""} onClick={() => setOrden("tipo")}>
            Por tipo
          </button>
          <button type="button" className={orden === "fecha" ? "active" : ""} onClick={() => setOrden("fecha")}>
            Por fecha
          </button>
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          {global && (
            <select
              className="input w-auto! min-w-[10rem] flex-1 sm:flex-none"
              value={empresaFiltro}
              onChange={(e) => setEmpresaFiltro(e.target.value)}
              aria-label="Empresa"
            >
              <option value="">Todas las empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.denominacion}
                </option>
              ))}
            </select>
          )}
          <select
            className="input w-auto! flex-1 sm:flex-none"
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as "" | TipoArchivo)}
            aria-label="Tipo"
          >
            <option value="">Todos los tipos</option>
            {TIPOS_ARCHIVO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="relative min-w-[12rem] flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-carbon/40" />
            <input
              className="input pl-8!"
              placeholder="Buscar por nombre…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
        </div>
      </div>

      {archivos.loading ? (
        <SkeletonTable rows={4} cols={3} />
      ) : archivos.error ? (
        <p className="text-sm text-bad">No se pudo cargar el archivo: {archivos.error}</p>
      ) : filtrados.length === 0 ? (
        <div className="card text-sm text-carbon/65">
          {archivos.data.length === 0 ? "Todavía no subiste documentos." : "No hay documentos con esos filtros."}
        </div>
      ) : orden === "tipo" ? (
        <div className="space-y-3">
          {grupos.map((g) => (
            <div key={g.tipo} className="table-shell">
              <p
                className="flex items-center justify-between border-b px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-musgo"
                style={{ borderColor: "var(--line)", background: "var(--color-marfil)" }}
              >
                {TIPO_ARCHIVO_LABEL[g.tipo]}
                <span className="font-normal text-carbon/50">{g.items.length}</span>
              </p>
              <ul className="divide-y divide-[var(--line)]">
                {g.items.map((a) => (
                  <FilaArchivo key={a.id} a={a} empresa={global ? nombres.get(a.empresa_id) : undefined} onBorrado={() => quitar(a.id)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-shell">
          <ul className="divide-y divide-[var(--line)]">
            {porFecha.map((a) => (
              <FilaArchivo key={a.id} a={a} empresa={global ? nombres.get(a.empresa_id) : undefined} onBorrado={() => quitar(a.id)} />
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] leading-snug text-carbon/50">
        Los archivos se guardan en un espacio privado: solo vos (y tu equipo, si sos administrador) pueden verlos. Los enlaces de descarga
        duran 60 segundos.
      </p>
    </section>
  );
}

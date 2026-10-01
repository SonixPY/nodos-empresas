"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, Mail, Pencil, RefreshCw, Search, Trash2, X, Check } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { SITIOS } from "@/lib/nodos/sitios";

interface Cuenta {
  id: string;
  email: string;
  nombre: string | null;
  usuario: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
  is_admin: boolean;
  acceso_finanzas: boolean;
  acceso_empresas: boolean;
  suspendido: boolean;
}

type Cambios = Partial<Pick<Cuenta, "nombre" | "usuario" | "email" | "is_admin" | "acceso_finanzas" | "acceso_empresas" | "suspendido">>;

function fmt(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("es-PY", { dateStyle: "short", timeStyle: "short" });
}

function Interruptor({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "bg-bosque" : "bg-carbon/20"
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

/** Panel de administración de cuentas NODOS: los cambios valen para las tres páginas. */
export default function AdminCuentas() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<Cuenta[] | null>(null);
  const [yo, setYo] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState({ nombre: "", usuario: "", email: "" });
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [claveDe, setClaveDe] = useState<Cuenta | null>(null);

  async function load() {
    setError(null);
    const res = await fetch("/api/admin/users");
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.message ?? "No se pudo cargar la lista de cuentas.");
      setUsers([]);
      return;
    }
    setUsers(data.users);
    setYo(data.yo ?? null);
    setPendiente(!!data.migracionPendiente);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function guardar(u: Cuenta, cambios: Cambios, ok: string) {
    setOcupado(u.id);
    const previo = users;
    setUsers((prev) => (prev ?? []).map((x) => (x.id === u.id ? { ...x, ...cambios } : x)));
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    const data = await res.json().catch(() => null);
    setOcupado(null);
    if (!res.ok) {
      setUsers(previo);
      showToast(data?.message ?? "No se pudo guardar el cambio.", "error");
      return false;
    }
    showToast(ok);
    return true;
  }

  async function recuperar(u: Cuenta) {
    setOcupado(u.id);
    const res = await fetch(`/api/admin/users/${u.id}/recuperar`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setOcupado(null);
    if (!res.ok) return showToast(data?.message ?? "No se pudo enviar el email.", "error");
    showToast(`Email de recuperación enviado a ${u.email}.`);
  }

  async function eliminar(u: Cuenta) {
    if (
      !confirm(
        `¿Eliminar la cuenta de ${u.email}? Se borran también todos sus datos en Finanzas y en Empresas. No se puede deshacer.`
      )
    )
      return;
    setOcupado(u.id);
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setOcupado(null);
    if (!res.ok) return showToast(data?.message ?? "No se pudo eliminar la cuenta.", "error");
    showToast(`Cuenta de ${u.email} eliminada.`);
    setUsers((prev) => (prev ?? []).filter((x) => x.id !== u.id));
  }

  async function guardarEdicion(u: Cuenta) {
    const cambios: Cambios = {};
    if ((borrador.nombre.trim() || null) !== u.nombre) cambios.nombre = borrador.nombre.trim() || null;
    if ((borrador.usuario.trim().toLowerCase() || null) !== u.usuario) cambios.usuario = borrador.usuario.trim().toLowerCase() || null;
    if (borrador.email.trim().toLowerCase() !== u.email) cambios.email = borrador.email.trim().toLowerCase();
    if (Object.keys(cambios).length === 0) return setEditando(null);
    if (await guardar(u, cambios, "Datos de la cuenta actualizados.")) setEditando(null);
  }

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (users ?? []).filter((u) => !q || u.email.toLowerCase().includes(q) || (u.nombre ?? "").toLowerCase().includes(q) || (u.usuario ?? "").includes(q));
  }, [users, busqueda]);

  const total = users?.length ?? 0;
  const admins = users?.filter((u) => u.is_admin).length ?? 0;
  const suspendidas = users?.filter((u) => u.suspendido).length ?? 0;

  return (
    <>
      <header className="mb-6">
        <h1>Administración de cuentas</h1>
        <p className="mt-1 text-carbon/65">
          Una sola base de cuentas para {SITIOS.finanzas.nombre} y {SITIOS.empresas.nombre}. Lo que cambies acá aplica en
          las tres páginas.
        </p>
      </header>

      {pendiente && (
        <div className="mb-5 rounded-lg border border-cobre/40 bg-cobre/10 px-4 py-3 text-sm">
          Falta correr la migración <code>000_cuentas_nodos.sql</code> en Supabase: hasta entonces solo se pueden
          eliminar cuentas.
        </div>
      )}

      <div className="mb-5 grid grid-cols-3 gap-2 sm:max-w-lg sm:gap-3">
        <div className="stat-tile">
          <p className="stat-label">Cuentas</p>
          <p className="stat-value">{total}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label truncate" title="Administradores"><span className="sm:hidden">Admins</span><span className="hidden sm:inline">Administradores</span></p>
          <p className="stat-value">{admins}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Suspendidas</p>
          <p className="stat-value">{suspendidas}</p>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-carbon/40" />
        <input
          className="input pl-9"
          placeholder="Buscar por email, nombre o usuario"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {error && <p className="mb-4 text-sm text-bad">{error}</p>}

      {users === null ? (
        <p className="text-carbon/60">Cargando...</p>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Cuenta</th>
                <th className="text-center">Admin</th>
                <th className="text-center">Finanzas</th>
                <th className="text-center">Empresas</th>
                <th className="text-center">Activa</th>
                <th>Último ingreso</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((u) => {
                const esYo = u.id === yo;
                const bloqueado = ocupado === u.id || pendiente;
                return (
                  <tr key={u.id} className={u.suspendido ? "opacity-60" : ""}>
                    <td className="min-w-[240px]">
                      {editando === u.id ? (
                        <div className="flex flex-col gap-1.5">
                          <input
                            className="input py-1"
                            placeholder="Nombre"
                            value={borrador.nombre}
                            onChange={(e) => setBorrador((b) => ({ ...b, nombre: e.target.value }))}
                          />
                          <input
                            className="input py-1"
                            placeholder="usuario"
                            value={borrador.usuario}
                            onChange={(e) => setBorrador((b) => ({ ...b, usuario: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "") }))}
                          />
                          <input
                            className="input py-1"
                            type="email"
                            value={borrador.email}
                            onChange={(e) => setBorrador((b) => ({ ...b, email: e.target.value }))}
                          />
                          <div className="flex gap-1">
                            <button type="button" className="btn btn-primary px-2.5 py-1 text-xs" onClick={() => guardarEdicion(u)}>
                              <Check size={13} /> Guardar
                            </button>
                            <button type="button" className="btn btn-ghost px-2.5 py-1 text-xs" onClick={() => setEditando(null)}>
                              <X size={13} /> Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-musgo">
                            {u.nombre || u.email}
                            {esYo && <span className="t-caption ml-2 text-carbon/45">(vos)</span>}
                          </p>
                          {u.usuario && <p className="text-xs font-medium text-cobre-hover">@{u.usuario}</p>}
                          {u.nombre && <p className="text-xs text-carbon/60">{u.email}</p>}
                          <p className="text-xs text-carbon/45">
                            Alta {fmt(u.created_at)}
                            {!u.confirmed_at && <span className="ml-1 text-cobre-hover">· sin confirmar</span>}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="text-center">
                      <Interruptor
                        label="Administrador"
                        on={u.is_admin}
                        disabled={bloqueado || esYo}
                        onChange={(v) => guardar(u, { is_admin: v }, v ? "Ahora es administrador." : "Ya no es administrador.")}
                      />
                    </td>
                    <td className="text-center">
                      <Interruptor
                        label="Acceso a Finanzas"
                        on={u.acceso_finanzas}
                        disabled={bloqueado}
                        onChange={(v) => guardar(u, { acceso_finanzas: v }, v ? "Acceso a Finanzas habilitado." : "Acceso a Finanzas quitado.")}
                      />
                    </td>
                    <td className="text-center">
                      <Interruptor
                        label="Acceso a Empresas"
                        on={u.acceso_empresas}
                        disabled={bloqueado}
                        onChange={(v) => guardar(u, { acceso_empresas: v }, v ? "Acceso a Empresas habilitado." : "Acceso a Empresas quitado.")}
                      />
                    </td>
                    <td className="text-center">
                      <Interruptor
                        label="Cuenta activa"
                        on={!u.suspendido}
                        disabled={bloqueado || esYo}
                        onChange={(v) => guardar(u, { suspendido: !v }, v ? "Cuenta reactivada." : "Cuenta suspendida.")}
                      />
                    </td>
                    <td className="whitespace-nowrap text-xs text-carbon/60">{fmt(u.last_sign_in_at)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Editar nombre, usuario y email"
                          disabled={bloqueado}
                          onClick={() => {
                            setBorrador({ nombre: u.nombre ?? "", usuario: u.usuario ?? "", email: u.email });
                            setEditando(u.id);
                          }}
                          className="rounded p-1.5 text-carbon/60 hover:bg-marfil hover:text-musgo disabled:opacity-40"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          title="Contraseña: definir una temporal o enviar email de recuperación"
                          disabled={ocupado === u.id}
                          onClick={() => setClaveDe(u)}
                          className="rounded p-1.5 text-carbon/60 hover:bg-marfil hover:text-musgo disabled:opacity-40"
                        >
                          <KeyRound size={15} />
                        </button>
                        <button
                          type="button"
                          title="Eliminar cuenta y todos sus datos"
                          disabled={ocupado === u.id || esYo}
                          onClick={() => eliminar(u)}
                          className="rounded p-1.5 text-carbon/60 hover:bg-bad/10 hover:text-bad disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-carbon/55">
                    No hay cuentas con ese criterio.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {claveDe && (
        <ClaveModal
          cuenta={claveDe}
          onCerrar={() => setClaveDe(null)}
          onEnviarEmail={async () => {
            await recuperar(claveDe);
            setClaveDe(null);
          }}
        />
      )}
      <p className="t-caption mt-4 text-carbon/50">
        Suspender bloquea el ingreso a todas las páginas. Quitar el acceso a una app solo impide entrar a esa app; los
        datos se conservan.
      </p>
    </>
  );
}

/** Generador de contraseñas temporales legibles (sin caracteres ambiguos). */
function claveTemporal(): string {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  const base = Array.from(arr, (n) => letras[n % letras.length]).join("");
  return `${base.slice(0, 4)}-${base.slice(4, 8)}-${base.slice(8, 12)}`;
}

function ClaveModal({
  cuenta,
  onCerrar,
  onEnviarEmail,
}: {
  cuenta: { id: string; email: string; nombre: string | null; usuario: string | null };
  onCerrar: () => void;
  onEnviarEmail: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [lista, setLista] = useState(false);
  const quien = cuenta.usuario ? `@${cuenta.usuario}` : cuenta.nombre || cuenta.email;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCerrar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (clave.length < 8) return showToast("La contraseña necesita al menos 8 caracteres.", "error");
    setGuardando(true);
    const res = await fetch(`/api/admin/users/${cuenta.id}/clave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave }),
    });
    const data = await res.json().catch(() => null);
    setGuardando(false);
    if (!res.ok) return showToast(data?.message ?? "No se pudo cambiar la contraseña.", "error");
    setLista(true);
    showToast(`Contraseña de ${quien} actualizada.`);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-carbon/40 p-4 sm:items-center" onMouseDown={onCerrar}>
      <div className="card w-full max-w-md" role="dialog" aria-modal="true" aria-label="Contraseña de la cuenta" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2">
              <KeyRound size={17} className="text-cobre" /> Contraseña
            </h3>
            <p className="truncate text-sm text-carbon/60">{quien}</p>
          </div>
          <button type="button" onClick={onCerrar} className="rounded p-1.5 text-carbon/60 hover:bg-marfil" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        {lista ? (
          <div className="space-y-3 text-sm">
            <p>
              Listo. Pasale la contraseña temporal a la persona por un canal privado y pedile que la cambie desde{" "}
              <strong>Mi cuenta</strong> al ingresar.
            </p>
            <button type="button" className="btn btn-primary w-full" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={guardar} className="space-y-2">
              <label className="field-label" htmlFor="clave-temporal">
                Definir una contraseña temporal
              </label>
              <div className="flex gap-1.5">
                <input
                  id="clave-temporal"
                  className="input min-w-0 flex-1 font-mono"
                  type={ver ? "text" : "password"}
                  autoComplete="new-password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  className="btn btn-ghost px-2.5"
                  title="Generar una contraseña segura"
                  onClick={() => {
                    setClave(claveTemporal());
                    setVer(true);
                  }}
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost px-2.5"
                  title="Copiar"
                  disabled={!clave}
                  onClick={() => navigator.clipboard?.writeText(clave).then(() => showToast("Copiada."))}
                >
                  <Copy size={15} />
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs text-carbon/60">
                <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar
              </label>
              <button type="submit" className="btn btn-primary w-full" disabled={guardando || clave.length < 8}>
                <Check size={15} /> {guardando ? "Guardando…" : "Guardar contraseña"}
              </button>
            </form>
            <div className="my-4 flex items-center gap-3 text-xs text-carbon/45">
              <span className="h-px flex-1 bg-[var(--line)]" /> o <span className="h-px flex-1 bg-[var(--line)]" />
            </div>
            <button type="button" className="btn btn-ghost w-full" onClick={onEnviarEmail}>
              <Mail size={15} /> Enviar email para que la elija la persona
            </button>
          </>
        )}
      </div>
    </div>
  );
}

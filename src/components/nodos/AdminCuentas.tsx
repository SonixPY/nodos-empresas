"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Pencil, Search, Trash2, X, Check } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { SITIOS } from "@/lib/nodos/sitios";

interface Cuenta {
  id: string;
  email: string;
  nombre: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
  is_admin: boolean;
  acceso_finanzas: boolean;
  acceso_empresas: boolean;
  suspendido: boolean;
}

type Cambios = Partial<Pick<Cuenta, "nombre" | "email" | "is_admin" | "acceso_finanzas" | "acceso_empresas" | "suspendido">>;

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
  const [borrador, setBorrador] = useState({ nombre: "", email: "" });
  const [ocupado, setOcupado] = useState<string | null>(null);

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
    if (!confirm(`¿Enviar a ${u.email} un email para elegir una contraseña nueva?`)) return;
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
    if (borrador.email.trim().toLowerCase() !== u.email) cambios.email = borrador.email.trim().toLowerCase();
    if (Object.keys(cambios).length === 0) return setEditando(null);
    if (await guardar(u, cambios, "Datos de la cuenta actualizados.")) setEditando(null);
  }

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (users ?? []).filter((u) => !q || u.email.toLowerCase().includes(q) || (u.nombre ?? "").toLowerCase().includes(q));
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

      <div className="mb-5 grid grid-cols-3 gap-3 sm:max-w-lg">
        <div className="stat-tile">
          <p className="stat-label">Cuentas</p>
          <p className="stat-value">{total}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Administradores</p>
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
          placeholder="Buscar por email o nombre"
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
                          title="Editar nombre y email"
                          disabled={bloqueado}
                          onClick={() => {
                            setBorrador({ nombre: u.nombre ?? "", email: u.email });
                            setEditando(u.id);
                          }}
                          className="rounded p-1.5 text-carbon/60 hover:bg-marfil hover:text-musgo disabled:opacity-40"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          title="Enviar email para cambiar la contraseña"
                          disabled={ocupado === u.id}
                          onClick={() => recuperar(u)}
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
      <p className="t-caption mt-4 text-carbon/50">
        Suspender bloquea el ingreso a todas las páginas. Quitar el acceso a una app solo impide entrar a esa app; los
        datos se conservan.
      </p>
    </>
  );
}

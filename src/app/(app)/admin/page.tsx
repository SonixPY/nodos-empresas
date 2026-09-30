"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
  is_admin: boolean;
}

function fmt(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("es-PY", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch("/api/admin/users");
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.message ?? "No se pudo cargar la lista de usuarios.");
      setUsers([]);
      return;
    }
    setUsers(data.users);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function handleDelete(user: AdminUser) {
    if (!confirm(`¿Eliminar la cuenta de ${user.email}? Esto borra también todos sus datos cargados. No se puede deshacer.`)) {
      return;
    }
    setDeletingId(user.id);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setDeletingId(null);
    if (!res.ok) {
      showToast(data?.message ?? "No se pudo eliminar el usuario.", "error");
      return;
    }
    showToast(`Cuenta de ${user.email} eliminada.`);
    setUsers((prev) => (prev ?? []).filter((u) => u.id !== user.id));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl">Administración</h1>
        <p className="mt-1 text-sm text-carbon/60">
          Cuentas registradas en la app. Eliminar una cuenta borra también todos sus datos (empresas, accionistas,
          vencimientos y documentos).
        </p>
      </header>

      {error && <p className="mb-4 text-sm text-bad">{error}</p>}

      {users === null ? (
        <p className="text-sm text-carbon/60">Cargando...</p>
      ) : users.length === 0 && !error ? (
        <p className="text-sm text-carbon/60">No hay usuarios registrados todavía.</p>
      ) : (
        <div className="table-shell">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-carbon/60">
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Registrado</th>
                <th className="px-3 py-2">Último ingreso</th>
                <th className="px-3 py-2">Email confirmado</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{u.email}</td>
                  <td className="whitespace-nowrap px-3 py-2">{fmt(u.created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{fmt(u.last_sign_in_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{u.confirmed_at ? "Sí" : "No"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{u.is_admin ? "Sí" : "No"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {!u.is_admin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        disabled={deletingId === u.id}
                        className="text-xs font-medium text-bad hover:underline disabled:opacity-50"
                      >
                        {deletingId === u.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

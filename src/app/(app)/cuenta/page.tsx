"use client";

import { useEffect, useState } from "react";
import { AtSign, Check, KeyRound, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ToastProvider";
import { USUARIO_REGEX } from "@/lib/nodos/sitios";

type Disponible = "libre" | "tomado" | "invalido" | "propio" | "verificando" | null;

/** Mi cuenta: nombre, usuario (lo que ven los demás) y contraseña. */
export default function CuentaPage() {
  const { showToast } = useToast();
  const [cargando, setCargando] = useState(true);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [original, setOriginal] = useState({ nombre: "", usuario: "" });
  const [disp, setDisp] = useState<Disponible>(null);
  const [guardando, setGuardando] = useState(false);
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [cambiandoClave, setCambiandoClave] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("nombre, usuario").eq("id", user.id).maybeSingle();
      const n = data?.nombre ?? (user.user_metadata?.nombre as string | undefined) ?? "";
      const u = data?.usuario ?? "";
      setEmail(user.email ?? "");
      setNombre(n);
      setUsuario(u);
      setOriginal({ nombre: n, usuario: u });
      setCargando(false);
    })();
  }, []);

  // Disponibilidad del usuario mientras se escribe.
  useEffect(() => {
    if (!usuario || usuario === original.usuario) return;
    if (!USUARIO_REGEX.test(usuario)) return;
    let vigente = true;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("usuario_disponible", { u: usuario });
      if (vigente) setDisp(error ? null : data ? "libre" : "tomado");
    }, 350);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [usuario, original.usuario]);

  const estado: Disponible = !usuario
    ? null
    : usuario === original.usuario
      ? "propio"
      : !USUARIO_REGEX.test(usuario)
        ? "invalido"
        : disp ?? "verificando";

  const hayCambios = nombre.trim() !== original.nombre || usuario !== original.usuario;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!hayCambios) return;
    const cambios: Record<string, string> = {};
    if (nombre.trim() !== original.nombre) cambios.nombre = nombre.trim();
    if (usuario !== original.usuario) cambios.usuario = usuario;
    setGuardando(true);
    const res = await fetch("/api/cuenta/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    const data = await res.json().catch(() => null);
    setGuardando(false);
    if (!res.ok) return showToast(data?.message ?? "No se pudo guardar.", "error");
    const n = data?.perfil?.nombre ?? nombre.trim();
    const u = data?.perfil?.usuario ?? usuario;
    setOriginal({ nombre: n, usuario: u });
    setDisp(null);
    window.dispatchEvent(new CustomEvent("nodos:perfil", { detail: { nombre: n, usuario: u || null } }));
    showToast("Tu cuenta quedó actualizada.");
  }

  async function cambiarClave(e: React.FormEvent) {
    e.preventDefault();
    if (clave.length < 8) return showToast("La contraseña necesita al menos 8 caracteres.", "error");
    if (clave !== clave2) return showToast("Las contraseñas no coinciden.", "error");
    setCambiandoClave(true);
    const { error } = await supabase.auth.updateUser({ password: clave });
    setCambiandoClave(false);
    if (error) return showToast(error.message, "error");
    setClave("");
    setClave2("");
    showToast("Contraseña cambiada.");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1>Mi cuenta</h1>
        <p className="mt-1 text-sm text-carbon/60">La misma cuenta para nodoscompliance.com, NODOS Finanzas y NODOS Empresas.</p>
      </header>

      {cargando ? (
        <div className="card flex items-center gap-2 text-sm text-carbon/60">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </div>
      ) : (
        <div className="space-y-6">
          <form onSubmit={guardar} className="card space-y-4">
            <div>
              <label className="field-label" htmlFor="nombre">
                Nombre
              </label>
              <input id="nombre" className="input" value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="usuario">
                Nombre de usuario
              </label>
              <div className="relative">
                <AtSign size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-carbon/45" />
                <input
                  id="usuario"
                  className="input pl-8"
                  value={usuario}
                  maxLength={20}
                  autoCapitalize="none"
                  autoComplete="username"
                  placeholder="tu.usuario"
                  onChange={(e) => {
                    setDisp(null);
                    setUsuario(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""));
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-carbon/55">
                {estado === "libre" && <span className="text-good">✓ Disponible</span>}
                {estado === "tomado" && <span className="text-bad">Ese usuario ya está tomado.</span>}
                {estado === "invalido" && <span className="text-bad">De 3 a 20 caracteres: minúsculas, números, punto o guion bajo.</span>}
                {estado === "verificando" && "Verificando…"}
                {(estado === null || estado === "propio") &&
                  "Es lo que se ve en las apps y en los rankings. También sirve para ingresar en lugar del email."}
              </p>
            </div>
            <div>
              <p className="field-label">Email</p>
              <p className="text-sm text-carbon/80">{email}</p>
              <p className="mt-1 text-xs text-carbon/50">Privado: solo lo ves vos. Sirve para ingresar y recuperar la contraseña.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!hayCambios || guardando || estado === "tomado" || estado === "invalido" || estado === "verificando"}
              >
                {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Guardar
              </button>
              {hayCambios && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setNombre(original.nombre);
                    setUsuario(original.usuario);
                  }}
                >
                  <X size={15} /> Descartar
                </button>
              )}
            </div>
          </form>

          <form onSubmit={cambiarClave} className="card space-y-4">
            <h3 className="flex items-center gap-2">
              <KeyRound size={17} className="text-cobre" /> Cambiar contraseña
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="password"
                className="input"
                placeholder="Contraseña nueva"
                autoComplete="new-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
              <input
                type="password"
                className="input"
                placeholder="Repetila"
                autoComplete="new-password"
                value={clave2}
                onChange={(e) => setClave2(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-ghost" disabled={!clave || cambiandoClave}>
              {cambiandoClave ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Cambiar contraseña
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

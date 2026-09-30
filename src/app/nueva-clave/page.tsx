"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AuthShell from "@/components/nodos/AuthShell";

export default function NuevaClavePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Links enviados desde el panel de admin traen la sesión en el fragmento (#access_token=...).
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ error: err }) => {
        if (err) setError("El link venció o ya se usó. Pedí uno nuevo.");
        window.history.replaceState(null, "", window.location.pathname);
      });
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) {
      return setError(/session/i.test(err.message) ? "El link venció o ya se usó. Pedí uno nuevo." : err.message);
    }
    setListo(true);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1200);
  }

  return (
    <AuthShell titulo="Elegí una contraseña nueva">
      {listo ? (
        <p className="text-good">Listo, tu contraseña quedó cambiada. Entrando...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="password">
            Contraseña nueva
          </label>
          <input
            id="password"
            type="password"
            required
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input mb-4"
          />
          <label className="field-label" htmlFor="confirm">
            Repetila
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input mb-4"
          />
          {error && <p className="mb-4 text-sm text-bad">{error}</p>}
          <button type="submit" disabled={submitting} className="btn btn-primary w-full justify-center">
            {submitting ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AuthShell from "@/components/nodos/AuthShell";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/nueva-clave`,
    });
    setSubmitting(false);
    if (err) return setError(err.message);
    setEnviado(true);
  }

  return (
    <AuthShell titulo="Recuperá tu contraseña" subtitulo="Te mandamos un link para elegir una nueva.">
      {enviado ? (
        <p className="text-carbon/75">
          Si existe una cuenta con <strong>{email}</strong>, en unos minutos te llega el email. Abrilo desde este mismo
          navegador.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mb-4"
          />
          {error && <p className="mb-4 text-sm text-bad">{error}</p>}
          <button type="submit" disabled={submitting} className="btn btn-primary w-full justify-center">
            {submitting ? "Enviando..." : "Enviar link"}
          </button>
        </form>
      )}
      <p className="mt-5 text-center text-sm">
        <Link href="/login" className="text-cobre-hover hover:underline">
          Volver a ingresar
        </Link>
      </p>
    </AuthShell>
  );
}

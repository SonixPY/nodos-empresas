"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    if (authError) {
      setError(authError.message === "Invalid login credentials" ? "Email o contraseña incorrectos." : authError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-musgo px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm">
        <h1 className="text-lg">Nodos Empresas</h1>
        <p className="mb-4 mt-1 text-sm text-carbon/60">Actas, vencimientos y libro de accionistas de tu empresa familiar.</p>
        <label className="field-label">Email</label>
        <input
          type="email"
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input mb-3"
        />
        <label className="field-label">Contraseña</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mb-3"
        />
        {error && <p className="mb-3 text-sm text-bad">{error}</p>}
        <button type="submit" disabled={submitting} className="btn btn-primary w-full justify-center">
          {submitting ? "Entrando..." : "Entrar"}
        </button>
        <p className="mt-4 text-center text-sm text-carbon/60">
          ¿No tenés cuenta?{" "}
          <Link href="/signup" className="text-cobre hover:underline">
            Registrate
          </Link>
        </p>
      </form>
    </main>
  );
}

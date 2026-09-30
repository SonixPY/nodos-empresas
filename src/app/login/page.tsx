"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AuthShell from "@/components/nodos/AuthShell";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(
    params.get("error") === "link" ? "El link venció o ya se usó. Pedí uno nuevo." : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (authError) {
      const m = authError.message;
      setError(
        m === "Invalid login credentials"
          ? "Email o contraseña incorrectos."
          : /banned/i.test(m)
            ? "Esta cuenta está suspendida. Escribí a soporte."
            : /not confirmed/i.test(m)
              ? "Todavía no confirmaste tu email. Revisá tu bandeja de entrada."
              : m
      );
      return;
    }
    const next = params.get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
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
      <div className="mb-1 flex items-baseline justify-between">
        <label className="field-label !mb-0" htmlFor="password">
          Contraseña
        </label>
        <Link href="/recuperar" className="t-caption text-cobre-hover hover:underline">
          ¿La olvidaste?
        </Link>
      </div>
      <input
        id="password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="input mb-4"
      />
      {error && <p className="mb-4 text-sm text-bad">{error}</p>}
      <button type="submit" disabled={submitting} className="btn btn-primary w-full justify-center">
        {submitting ? "Ingresando..." : "Ingresar"}
      </button>
      <p className="mt-5 text-center text-sm text-carbon/65">
        ¿No tenés cuenta?{" "}
        <Link href="/signup" className="font-medium text-cobre-hover hover:underline">
          Creá tu cuenta NODOS
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell titulo="Ingresá a tu cuenta" subtitulo="La misma cuenta sirve para Finanzas y Empresas.">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    const { data, error: authError } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (data.session) {
      // Confirmación de email desactivada en el proyecto de Supabase: ya
      // queda logueado.
      router.push("/");
      router.refresh();
      return;
    }

    // Confirmación de email activada: hay que esperar el mail antes de
    // poder loguearse.
    setNeedsConfirmation(true);
  }

  if (needsConfirmation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-musgo px-4">
        <div className="card w-full max-w-sm text-center">
          <h1 className="mb-3 text-lg">Revisá tu email</h1>
          <p className="text-sm text-carbon/70">
            Te mandamos un link de confirmación a <strong>{email}</strong>. Una vez que lo confirmes, ya podés{" "}
            <Link href="/login" className="text-cobre hover:underline">
              iniciar sesión
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-musgo px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm">
        <h1 className="text-lg">Crear cuenta</h1>
        <p className="mb-4 mt-1 text-sm text-carbon/60">Nodos Empresas: el orden legal de tu empresa familiar, en un solo lugar.</p>
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mb-3"
        />
        <label className="field-label">Repetir contraseña</label>
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input mb-3"
        />
        {error && <p className="mb-3 text-sm text-bad">{error}</p>}
        <button type="submit" disabled={submitting} className="btn btn-primary w-full justify-center">
          {submitting ? "Creando cuenta..." : "Crear cuenta"}
        </button>
        <p className="mt-4 text-center text-sm text-carbon/60">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-cobre hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </form>
    </main>
  );
}

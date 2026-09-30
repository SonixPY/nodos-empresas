"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AuthShell from "@/components/nodos/AuthShell";

export default function SignupPage() {
  const [nombre, setNombre] = useState("");
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
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirmPassword) return setError("Las contraseñas no coinciden.");

    setSubmitting(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre: nombre.trim() || null },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSubmitting(false);

    if (authError) {
      setError(/already registered/i.test(authError.message) ? "Ya existe una cuenta con ese email. Ingresá." : authError.message);
      return;
    }
    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }
    setNeedsConfirmation(true);
  }

  if (needsConfirmation) {
    return (
      <AuthShell titulo="Revisá tu email">
        <p className="text-carbon/75">
          Te mandamos un link de confirmación a <strong>{email}</strong>. Cuando lo abras, tu cuenta NODOS queda lista
          para Finanzas y Empresas.
        </p>
        <Link href="/login" className="btn btn-ghost mt-6">
          Volver a ingresar
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell titulo="Creá tu cuenta NODOS" subtitulo="Una sola cuenta para Finanzas y Empresas.">
      <form onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="nombre">
          Nombre
        </label>
        <input
          id="nombre"
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="input mb-4"
        />
        <label className="field-label" htmlFor="email">
          Email<span className="required-mark">*</span>
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input mb-4"
        />
        <label className="field-label" htmlFor="password">
          Contraseña<span className="required-mark">*</span>
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mb-1"
        />
        <p className="t-caption mb-4 text-carbon/50">Mínimo 8 caracteres.</p>
        <label className="field-label" htmlFor="confirm">
          Repetí la contraseña<span className="required-mark">*</span>
        </label>
        <input
          id="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input mb-4"
        />
        {error && <p className="mb-4 text-sm text-bad">{error}</p>}
        <button type="submit" disabled={submitting} className="btn btn-primary w-full justify-center">
          {submitting ? "Creando cuenta..." : "Crear cuenta"}
        </button>
        <p className="mt-5 text-center text-sm text-carbon/65">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-medium text-cobre-hover hover:underline">
            Ingresá
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

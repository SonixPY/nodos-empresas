"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/nodos/AuthShell";
import { SITIOS, USUARIO_REGEX } from "@/lib/nodos/sitios";

export default function SignupPage() {
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [acepta, setAcepta] = useState(false);
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
    if (nombre.trim().length < 2) return setError("Contanos tu nombre.");
    if (!USUARIO_REGEX.test(usuario)) return setError("El usuario lleva de 3 a 20 caracteres: minúsculas, números, punto o guion bajo.");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirmPassword) return setError("Las contraseñas no coinciden.");
    if (!acepta) return setError("Para crear la cuenta tenés que aceptar los Términos y la Política de privacidad.");

    // Mismo alta que la pantalla de nodoscompliance.com/ingresar: el servidor
    // valida los datos y guarda la aceptación de los términos.
    setSubmitting(true);
    const res = await fetch("/api/cuenta/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim(), usuario, email, clave: password, acepta_terminos: true }),
    }).catch(() => null);
    const j = (await res?.json().catch(() => null)) as { ok?: boolean; confirmar?: boolean; message?: string } | null;
    setSubmitting(false);

    if (!res?.ok || !j?.ok) {
      setError(j?.message ?? "No pudimos crear la cuenta. Probá de nuevo.");
      return;
    }
    if (!j.confirmar) {
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
          required
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="input mb-4"
        />
        <label className="field-label" htmlFor="usuario">
          Usuario<span className="required-mark">*</span>
        </label>
        <input
          id="usuario"
          required
          autoComplete="username"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/\s/g, ""))}
          className="input mb-1"
        />
        <p className="t-caption mb-4 text-carbon/50">3 a 20 caracteres: minúsculas, números, punto o guion bajo.</p>
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
        <label className="mb-4 flex items-start gap-2 text-sm text-carbon/75">
          <input type="checkbox" required checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1 accent-[var(--color-cobre)]" />
          <span>
            Acepto los{" "}
            <a href={`${SITIOS.inicio.url}/terminos`} target="_blank" rel="noopener" className="font-medium text-cobre-hover hover:underline">
              Términos
            </a>{" "}
            y la{" "}
            <a href={`${SITIOS.inicio.url}/privacidad`} target="_blank" rel="noopener" className="font-medium text-cobre-hover hover:underline">
              Política de privacidad
            </a>
            .
          </span>
        </label>
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

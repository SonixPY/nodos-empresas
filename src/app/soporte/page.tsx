"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Mail } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { APP_ID } from "@/lib/nodos/app";
import { SITIOS, SOPORTE_EMAIL } from "@/lib/nodos/sitios";

const TIPOS = ["Problema técnico", "Acceso o cuenta", "Privacidad y datos", "Sugerencia", "Otro"];
const APPS = [SITIOS.finanzas.nombre, SITIOS.empresas.nombre, "nodoscompliance.com"];

export default function SoportePage() {
  const [email, setEmail] = useState("");
  const [logueado, setLogueado] = useState(false);
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [app, setApp] = useState<string>(SITIOS[APP_ID].nombre);
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        setEmail(data.user.email);
        setLogueado(true);
      }
    });
  }, []);

  function abrirCorreo(e: React.FormEvent) {
    e.preventDefault();
    const subject = `[Soporte NODOS · ${tipo}] ${asunto || app}`;
    const body = [
      mensaje,
      "",
      "—",
      `App: ${app}`,
      `Cuenta: ${email || "(sin sesión)"}`,
      `Página: ${document.referrer || window.location.href}`,
      `Navegador: ${navigator.userAgent}`,
    ].join("\n");
    window.location.href = `mailto:${SOPORTE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function copiar() {
    await navigator.clipboard.writeText(SOPORTE_EMAIL).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <main className="min-h-screen bg-marfil">
      <header className="bg-musgo">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/isotipo.svg" alt="" width={28} height={28} className="rounded" />
          <span className="text-marfil">
            <span className="wordmark">NODOS</span> <span className="font-display text-marfil/70">Soporte</span>
          </span>
          <Link href={logueado ? "/" : "/login"} className="ml-auto flex items-center gap-1 text-sm text-marfil/70 hover:text-marfil">
            <ArrowLeft size={15} /> Volver
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1>¿En qué te ayudamos?</h1>
        <p className="t-body-lg mt-2 text-carbon/70">
          Tu mensaje llega al equipo de IT de NODOS. Respondemos por correo, en días hábiles.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
          <form onSubmit={abrirCorreo} className="card">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="tipo">
                  Tipo de consulta
                </label>
                <select id="tipo" className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  {TIPOS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="app">
                  ¿Dónde pasa?
                </label>
                <select id="app" className="input" value={app} onChange={(e) => setApp(e.target.value)}>
                  {APPS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="field-label mt-4" htmlFor="email">
              Tu email de contacto
            </label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="field-label mt-4" htmlFor="asunto">
              Asunto
            </label>
            <input id="asunto" className="input" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
            <label className="field-label mt-4" htmlFor="mensaje">
              Contanos qué pasa<span className="required-mark">*</span>
            </label>
            <textarea
              id="mensaje"
              required
              rows={6}
              className="input"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Qué estabas haciendo, qué esperabas que pase y qué pasó."
            />
            <p className="t-caption mt-2 text-carbon/55">
              No incluyas contraseñas, números de tarjeta ni datos de terceros en el mensaje.
            </p>
            <button type="submit" className="btn btn-primary mt-5">
              <Mail size={15} /> Abrir el correo
            </button>
          </form>

          <aside className="space-y-4 text-sm">
            <div className="card">
              <p className="t-caption uppercase tracking-wider text-carbon/55">Correo de IT</p>
              <p className="mt-1 break-all font-medium text-musgo">{SOPORTE_EMAIL}</p>
              <button type="button" onClick={copiar} className="mt-2 flex items-center gap-1 text-cobre-hover hover:underline">
                <Copy size={13} /> {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
            <div className="card text-carbon/70">
              <p className="font-medium text-musgo">Accesos rápidos</p>
              <ul className="mt-2 space-y-1">
                <li>
                  <Link href="/recuperar" className="text-cobre-hover hover:underline">
                    Recuperar contraseña
                  </Link>
                </li>
                <li>
                  <a href={SITIOS.inicio.url} className="text-cobre-hover hover:underline">
                    nodoscompliance.com
                  </a>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

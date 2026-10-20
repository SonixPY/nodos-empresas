"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { aplicarTema, guardarTema, leerTema, type Tema } from "@/lib/nodos/tema";

const OPCIONES: { valor: Tema; label: string; icon: typeof Sun }[] = [
  { valor: "claro", label: "Claro", icon: Sun },
  { valor: "oscuro", label: "Oscuro", icon: Moon },
  { valor: "auto", label: "Automático", icon: Monitor },
];

/** Tema de la plataforma (idéntico en las dos apps). Se guarda para las tres páginas. */
export default function TemaSelector({ compacto = false }: { compacto?: boolean }) {
  const [tema, setTema] = useState<Tema>("claro");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTema(leerTema());
    const onTema = (e: Event) => setTema((e as CustomEvent<Tema>).detail);
    window.addEventListener("nodos:tema", onTema);
    // En "auto", si el sistema cambia de claro a oscuro, se acompaña.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSistema = () => leerTema() === "auto" && aplicarTema("auto");
    mq.addEventListener("change", onSistema);
    return () => {
      window.removeEventListener("nodos:tema", onTema);
      mq.removeEventListener("change", onSistema);
    };
  }, []);

  const grupo = (
    <div className={`segmented ${compacto ? "segmented-sm w-full [&>button]:flex-1 [&>button]:justify-center" : ""}`} role="radiogroup" aria-label="Tema">
      {OPCIONES.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={tema === o.valor} className={`inline-flex items-center gap-1.5 ${tema === o.valor ? "active" : ""}`} onClick={() => guardarTema(o.valor)}>
          <o.icon size={14} aria-hidden /> {compacto && o.valor === "auto" ? "Auto" : o.label}
        </button>
      ))}
    </div>
  );

  if (compacto) return grupo;
  return (
    <section className="card space-y-3" aria-labelledby="tema-titulo">
      <div>
        <h3 id="tema-titulo">Tema</h3>
        <p className="text-sm text-carbon/60">Claro, oscuro o el mismo que tu dispositivo. Se aplica en nodoscompliance.com, Finanzas, Empresas y Práctica.</p>
      </div>
      {grupo}
    </section>
  );
}

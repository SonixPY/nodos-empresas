"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BookOpen, CalendarDays, History, LampDesk } from "lucide-react";
import SitioSwitcher from "@/components/nodos/SitioSwitcher";
import CuentaMenu from "@/components/nodos/CuentaMenu";
import { usePerfil } from "@/lib/nodos/usePerfil";
import { nombreMes } from "@/lib/nodos/aprender";
import { useCarrera } from "./CarreraProvider";
import ResumenMesModal from "./ResumenMesModal";

const SECCIONES = [
  { href: "/aprender", label: "Escritorio", icon: LampDesk },
  { href: "/aprender/mes", label: "Mes", icon: CalendarDays },
  { href: "/aprender/biblioteca", label: "Biblioteca", icon: BookOpen },
  { href: "/aprender/historial", label: "Historial", icon: History },
];

/** Encabezado y marco de NODOS Aprender (idéntico en las dos apps). */
export default function AprenderShell({ children }: { children: ReactNode }) {
  const perfil = usePerfil();
  const pathname = usePathname();
  const { carrera, estado, error, recargar } = useCarrera();
  const activa = (href: string) => (href === "/aprender" ? pathname === href : pathname.startsWith(href));

  return (
    <>
      {/* Letra manuscrita de los post-its. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap" precedence="default" />
      <header className="sticky top-0 z-20 border-b-2 border-cobre bg-musgo text-marfil print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <SitioSwitcher pagina="practica" />
          <div className="flex items-center gap-3">
            {estado === "jugando" && carrera && (
              <span className="hidden text-sm text-marfil/85 sm:inline">
                Mes {carrera.mes} · <span className="capitalize">{nombreMes(carrera)}</span>
              </span>
            )}
            <CuentaMenu perfil={perfil} />
          </div>
        </div>
        <nav aria-label="Secciones de Aprender" className="mx-auto max-w-6xl px-2 sm:px-4">
          <ul className="flex gap-1 overflow-x-auto pb-1.5">
            {SECCIONES.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={activa(href) ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm transition ${
                    activa(href) ? "bg-marfil/15 font-medium text-marfil" : "text-marfil/80 hover:bg-marfil/10 hover:text-marfil"
                  }`}
                >
                  <Icon size={16} aria-hidden /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {error && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-carbon">
            <span>{error}</span>
            {estado === "error" && (
              <button type="button" className="btn btn-ghost" onClick={recargar}>
                Reintentar
              </button>
            )}
          </div>
        )}
        {children}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-carbon/55 sm:px-6">
        NODOS Aprender · Simulador educativo con datos ficticios. No constituye asesoría de inversión ni asesoramiento legal personalizado.
      </footer>
      <ResumenMesModal />
    </>
  );
}

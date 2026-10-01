"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import AppsMenu from "@/components/nodos/AppsMenu";
import { cerrarSesion, usePerfil } from "@/lib/nodos/usePerfil";
import { nombreVisible } from "@/lib/nodos/sitios";

const LINKS = [
  { href: "/", label: "Resumen" },
  { href: "/empresas", label: "Empresas" },
  { href: "/vencimientos", label: "Vencimientos" },
  { href: "/documentos", label: "Documentos" },
  { href: "/cumplimiento", label: "SEPRELAD" },
];

export default function NavBar() {
  const pathname = usePathname();
  const perfil = usePerfil();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav className="sticky top-0 z-20 bg-musgo shadow-[0_1px_0_rgba(184,115,74,0.35)] print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3 sm:px-6 lg:py-3.5 lg:px-8">
        <Link href="/" className="order-1 mr-4 flex items-center gap-2 text-lg text-marfil lg:mr-6" aria-label="NODOS Empresas — Resumen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/isotipo.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
          <span className="leading-none">
            <span className="wordmark">NODOS</span> <span className="font-display font-normal">Empresas</span>
          </span>
        </Link>
        <div className="order-3 -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] lg:order-2 lg:mx-0 lg:w-auto lg:px-0">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
                isActive(link.href) ? "bg-cobre/20 text-marfil" : "text-marfil/70 hover:bg-marfil/10 hover:text-marfil"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 lg:order-3">
          {perfil && (
            <Link href="/cuenta" className="hidden max-w-[160px] truncate text-xs text-marfil/60 transition hover:text-marfil lg:inline">
              {nombreVisible(perfil)}
            </Link>
          )}
          <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-marfil/10 px-1.5 py-1">
            <AppsMenu perfil={perfil} />
            <button
              type="button"
              onClick={cerrarSesion}
              title="Salir"
              className="rounded-full p-1.5 text-marfil/70 transition hover:bg-marfil/10 hover:text-marfil"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

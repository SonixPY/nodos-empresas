"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SitioSwitcher from "@/components/nodos/SitioSwitcher";
import CuentaMenu from "@/components/nodos/CuentaMenu";
import { usePerfil } from "@/lib/nodos/usePerfil";

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
      {/* Celular/tablet: fila 1 = selector de páginas (logo) + menú de cuenta;
          fila 2 = links con scroll horizontal. Desde lg, una sola fila. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3 sm:px-6 lg:py-3.5 lg:px-8">
        <div className="order-1 mr-auto flex min-w-0 lg:mr-6">
          <SitioSwitcher />
        </div>
        <div className="order-3 -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] lg:order-2 lg:mx-0 lg:w-auto lg:px-0">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
                isActive(link.href) ? "bg-cobre/20 text-marfil" : "text-marfil/70 hover:bg-marfil/10 hover:text-marfil"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Cuenta: Mi cuenta, Soporte, NODOS Panel (administradores) y Salir. */}
        <div className="order-2 ml-auto flex shrink-0 items-center lg:order-3">
          <CuentaMenu perfil={perfil} />
        </div>
      </div>
    </nav>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AtSign, Building2, Gauge, Globe, LayoutGrid, LifeBuoy, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { APP_ID } from "@/lib/nodos/app";
import { SITIOS, nombreVisible } from "@/lib/nodos/sitios";
import type { PerfilVisible } from "@/lib/nodos/usePerfil";

/**
 * Selector de apps NODOS del header: salta entre el sitio, Finanzas y
 * Empresas con la misma sesión, y da acceso a Administración y Soporte.
 */
export default function AppsMenu({ perfil }: { perfil: PerfilVisible | null }) {
  const isAdmin = !!perfil?.isAdmin;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const apps = [
    { id: "inicio", icon: Globe, ...SITIOS.inicio, corto: "Inicio" },
    { id: "finanzas", icon: Wallet, ...SITIOS.finanzas },
    { id: "empresas", icon: Building2, ...SITIOS.empresas },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Apps NODOS"
        aria-expanded={open}
        className={`rounded-full p-1.5 transition ${open ? "bg-marfil/15 text-marfil" : "text-marfil/70 hover:bg-marfil/10 hover:text-marfil"}`}
      >
        <LayoutGrid size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-lg border border-[var(--line)] bg-white text-carbon shadow-lg">
          {perfil && (
            <Link
              href="/cuenta"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 border-b border-[var(--line)] bg-marfil/60 px-4 py-3 transition hover:bg-marfil"
            >
              <UserRound size={18} className="shrink-0 text-cobre" />
              <span className="min-w-0">
                <span className="t-caption block text-carbon/55">Cuenta NODOS</span>
                <span className="block truncate text-sm font-medium text-musgo">{nombreVisible(perfil)}</span>
                {!perfil.usuario && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-cobre-hover">
                    <AtSign size={12} /> Elegí tu nombre de usuario
                  </span>
                )}
              </span>
            </Link>
          )}
          <ul className="p-1.5">
            {apps.map((a) => {
              const actual = a.id === APP_ID;
              const Icon = a.icon;
              return (
                <li key={a.id}>
                  <a
                    href={actual ? "/" : a.url}
                    className={`flex items-start gap-3 rounded-md px-3 py-2.5 transition hover:bg-marfil ${actual ? "bg-marfil" : ""}`}
                  >
                    <Icon size={18} className="mt-0.5 shrink-0 text-cobre" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-musgo">
                        {a.id === "inicio" ? "nodoscompliance.com" : a.nombre}
                        {actual && <span className="t-caption ml-2 text-carbon/45">estás acá</span>}
                      </span>
                      <span className="block text-xs leading-snug text-carbon/55">{a.descripcion}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[var(--line)] p-1.5">
            {isAdmin && (
              <a
                href={APP_ID === "empresas" ? "/panel" : `${SITIOS.empresas.url}/panel`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-marfil"
              >
                <Gauge size={16} className="text-musgo" /> NODOS Panel (centro de comandos)
              </a>
            )}
            {isAdmin && (
              <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-marfil">
                <ShieldCheck size={16} className="text-musgo" /> Administración de cuentas
              </Link>
            )}
            <Link href="/soporte" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-marfil">
              <LifeBuoy size={16} className="text-musgo" /> Soporte
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

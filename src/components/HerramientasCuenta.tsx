"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { MENU_ITEM } from "@/components/nodos/CuentaMenu";

/** Herramientas de NODOS Empresas dentro del menú de cuenta. */
export default function HerramientasCuenta() {
  const pathname = usePathname();
  const activo = pathname === "/configuracion";
  return (
    <Link href="/configuracion" role="menuitem" aria-current={activo ? "page" : undefined} className={`${MENU_ITEM} ${activo ? "bg-marfil font-medium text-musgo" : ""}`}>
      <Settings size={16} aria-hidden className="shrink-0 text-musgo" /> Configuración y descargas
    </Link>
  );
}

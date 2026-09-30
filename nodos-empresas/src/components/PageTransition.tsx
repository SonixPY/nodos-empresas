"use client";

import { usePathname } from "next/navigation";

/** Envuelve el contenido de cada página con un fade-in sutil al navegar
 * entre pestañas — la key por ruta hace que React remonte (y re-anime)
 * el wrapper cada vez que cambia de página. */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-in">
      {children}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, FilePen, FolderClock, Stamp } from "lucide-react";

const LINKS = [
  { href: "/documentos", label: "Generar", icon: FilePen },
  { href: "/documentos/guardados", label: "Guardados", icon: FolderClock },
  { href: "/documentos/poderes", label: "Poderes", icon: Stamp },
  { href: "/documentos/archivo", label: "Archivo", icon: Archive },
];

/** Encabezado + pestañas de la sección Documentos. */
export default function DocumentosNav({ descripcion }: { descripcion?: string }) {
  const pathname = usePathname();
  const activo = (href: string) => (href === "/documentos" ? pathname === "/documentos" : pathname.startsWith(href));
  return (
    <header className="mb-6 space-y-3">
      <div>
        <h1>Documentos</h1>
        {descripcion && <p className="mt-1 text-sm text-carbon/60">{descripcion}</p>}
      </div>
      <nav className="segmented" aria-label="Secciones de documentos">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-1.5 ${activo(l.href) ? "active" : ""}`}
            aria-current={activo(l.href) ? "page" : undefined}
          >
            <l.icon size={14} />
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

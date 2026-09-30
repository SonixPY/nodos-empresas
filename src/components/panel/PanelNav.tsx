"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, Users } from "lucide-react";

const LINKS = [
  { href: "/panel", label: "Resumen", icon: LayoutDashboard },
  { href: "/panel/leads", label: "Leads", icon: Users },
  { href: "/panel/contenido", label: "Contenido", icon: CalendarDays },
];

export default function PanelNav() {
  const pathname = usePathname();
  const activo = (href: string) => (href === "/panel" ? pathname === "/panel" : pathname.startsWith(href));
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
      <div>
        <p className="t-caption uppercase tracking-[0.14em] text-cobre-hover">Centro de comandos · solo administradores</p>
        <p className="font-display text-xl font-bold text-musgo">
          <span className="wordmark">NODOS</span> <span className="font-normal">Panel</span>
        </p>
      </div>
      <nav className="segmented" aria-label="Secciones del panel">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`flex items-center gap-1.5 ${activo(l.href) ? "active" : ""}`}>
            <l.icon size={14} />
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const LINKS = [
  { href: "/", label: "Resumen" },
  { href: "/empresas", label: "Empresas" },
  { href: "/vencimientos", label: "Vencimientos" },
  { href: "/documentos", label: "Documentos" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      if (active) setEmail(user.email ?? null);
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      if (active) setIsAdmin(!!data?.is_admin);
    }
    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav className="sticky top-0 z-20 bg-musgo shadow-[0_1px_0_rgba(184,115,74,0.35)] print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3.5 sm:px-6 lg:px-8">
        <Link href="/" className="mr-6 flex items-center gap-2 font-serif text-lg font-semibold text-marfil">
          <span className="inline-block h-2 w-2 rounded-full bg-cobre" />
          Nodos <span className="font-sans text-sm font-normal text-marfil/60">Empresas</span>
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                isActive(link.href) ? "bg-cobre/20 text-cobre" : "text-marfil/70 hover:bg-marfil/10 hover:text-marfil"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {email && <span className="hidden text-xs text-marfil/50 md:inline">{email}</span>}
          <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-marfil/10 px-1.5 py-1">
            {isAdmin && (
              <Link
                href="/admin"
                title="Administración"
                className={`rounded-full p-1.5 transition ${
                  pathname === "/admin" ? "bg-cobre/30 text-marfil" : "text-marfil/70 hover:bg-marfil/10 hover:text-marfil"
                }`}
              >
                <ShieldCheck size={15} />
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
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

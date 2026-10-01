import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import PanelNav from "@/components/nodos/PanelNav";

// El Panel es solo para administradores: se verifica en el servidor, y además
// la base (RLS) solo les entrega datos a ellos.
export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/panel");
  const { data: perfil } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!perfil?.is_admin) redirect("/");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PanelNav />
      {children}
    </div>
  );
}

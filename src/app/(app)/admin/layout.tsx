import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

// Administración de cuentas: solo administradores (se verifica en el servidor;
// la API de cuentas también lo exige).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: perfil } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!perfil?.is_admin) redirect("/");
  return <>{children}</>;
}

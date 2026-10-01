import AdminCuentas from "@/components/nodos/AdminCuentas";
import PanelNav from "@/components/nodos/PanelNav";

// Administración de cuentas: es parte de NODOS Panel (solo administradores).
export default function AdminPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PanelNav />
      <AdminCuentas />
    </main>
  );
}

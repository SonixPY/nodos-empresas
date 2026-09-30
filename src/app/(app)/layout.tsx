import NavBar from "@/components/NavBar";
import { ToastProvider } from "@/components/ToastProvider";
import PageTransition from "@/components/PageTransition";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <NavBar />
      <PageTransition>{children}</PageTransition>
      <footer className="mx-auto mt-auto w-full max-w-6xl px-4 py-8 text-xs text-carbon/50 sm:px-6 lg:px-8 print:hidden">
        Nodos Empresas · Herramienta de gestión e información. No constituye asesoramiento legal personalizado.
      </footer>
    </ToastProvider>
  );
}

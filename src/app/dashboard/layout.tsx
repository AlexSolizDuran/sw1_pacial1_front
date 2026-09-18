import { RequireAuth } from "@/components/auth/require-auth";
import { HelpPanel } from "@/components/help/HelpPanel";

/**
 * Layout del dashboard (rutas protegidas).
 * Verifica que el usuario tenga sesion antes de mostrar el contenido
 * y monta el panel global de ayuda (boton ? en toda la zona post-login).
 */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <RequireAuth>
      {children}
      <HelpPanel />
    </RequireAuth>
  );
}

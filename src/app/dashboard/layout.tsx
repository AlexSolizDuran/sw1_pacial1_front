import { RequireAuth } from "@/components/auth/require-auth";

/**
 * Layout del dashboard (rutas protegidas).
 * Verifica que el usuario tenga sesion antes de mostrar el contenido.
 */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <RequireAuth>{children}</RequireAuth>;
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";

/**
 * Guard de autenticacion para rutas protegidas.
 * Si el usuario no tiene sesion y ya termino de cargar el perfil,
 * redirige a la pagina de login.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Muestra un indicador mientras se verifica la sesion
  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-on-surface-variant">Cargando...</span>
      </div>
    );
  }

  return <>{children}</>;
}

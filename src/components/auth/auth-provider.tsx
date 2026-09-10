"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";

/**
 * Proveedor de autenticacion.
 * Al montar la aplicacion carga el perfil del usuario (si hay sesion)
 * desde el backend, para que el resto de componentes conozcan el estado.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  return <>{children}</>;
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";

/**
 * Barra de navegacion superior (Proton).
 * Muestra el logo, enlaces a login/registro si no hay sesion, o el nombre
 * del usuario con el boton de cerrar sesion si ya esta autenticado.
 */
export function Header() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  /**
   * Cierra la sesion en el backend y redirige a la landing.
   */
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-outline-variant bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-headline text-lg font-semibold tracking-tight"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-sm font-bold text-on-primary-container">
            UML
          </span>
          <span className="text-on-surface">Diagramador</span>
        </Link>

        <nav className="flex items-center gap-3">
          {loading ? (
            <span className="text-sm text-on-surface-variant">
              Cargando...
            </span>
          ) : user ? (
            <>
              <Link
                href="/dashboard/profile"
                className="hidden text-sm text-on-surface-variant transition-colors hover:text-on-surface sm:inline"
              >
                Mi perfil
              </Link>
              <span className="hidden text-sm text-on-surface-variant sm:inline">
                {user.name}
              </span>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="h-10 rounded-md border border-outline-variant px-5 text-sm text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
              >
                {isLoggingOut ? "Cerrando..." : "Cerrar sesion"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="h-10 rounded-md px-5 text-sm text-on-surface-variant transition-colors hover:text-on-surface"
              >
                Iniciar sesion
              </Link>
              <Link
                href="/register"
                className="h-10 rounded-md bg-primary-container px-5 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed"
              >
                Registrarse
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

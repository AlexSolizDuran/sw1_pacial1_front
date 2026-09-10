"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";

/**
 * Landing page de la aplicacion.
 * Muestra boton "Ir al Dashboard" si el usuario esta autenticado,
 * o "Comenzar gratis" / "Iniciar sesion" si no lo esta.
 */
export default function Home() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="flex w-full flex-1 flex-col items-center justify-center px-6 py-32 text-center">
        <div className="flex w-full max-w-3xl flex-col items-center gap-6">
          <span className="inline-flex items-center rounded-md border border-outline-variant bg-surface-container px-4 py-1.5 text-xs font-medium text-on-surface-variant">
            Colaboracion en tiempo real con Yjs
          </span>

          <h1 className="max-w-2xl font-headline text-4xl font-bold leading-tight tracking-tight text-on-surface sm:text-5xl">
            Diagramas de clases UML,{" "}
            <span className="text-primary-container">colaborativos</span> y en
            vivo
          </h1>

          <p className="max-w-xl text-lg leading-8 text-on-surface-variant">
            Crea, edita y comparte diagramas de clases con tu equipo en tiempo
            real. Con asistencia de IA y generacion de codigo backend.
          </p>

          <div className="flex flex-col gap-3 pt-4 sm:flex-row">
            {!loading && user ? (
              <Link
                href="/dashboard"
                className="flex h-12 w-full items-center justify-center rounded-md bg-primary-container px-6 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed md:w-[180px]"
              >
                Ir al Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="flex h-12 w-full items-center justify-center rounded-md bg-primary-container px-6 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed md:w-[180px]"
                >
                  Comenzar gratis
                </Link>
                <Link
                  href="/login"
                  className="flex h-12 w-full items-center justify-center rounded-md border border-outline-variant px-6 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high md:w-[180px]"
                >
                  Iniciar sesion
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Caracteristicas */}
      <section className="w-full border-t border-outline-variant">
        <div className="mx-auto grid w-full max-w-6xl gap-px py-20 sm:grid-cols-3">
          {[
            {
              title: "Editor UML completo",
              text: "Clases, interfaces, enumeraciones y 5 tipos de relacion. Edita atributos y metodos al instante.",
            },
            {
              title: "Colaboracion en vivo",
              text: "Varios usuarios editan el mismo diagrama al mismo tiempo con cursores y bloqueo de elementos.",
            },
            {
              title: "Asistencia IA",
              text: "Genera codigo backend Spring Boot y recibe ayuda con el asistente integrado.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-3 px-8 py-6 text-center sm:text-left"
            >
              <h3 className="font-headline text-lg font-semibold tracking-tight text-on-surface">
                {feature.title}
              </h3>
              <p className="text-sm leading-6 text-on-surface-variant">
                {feature.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

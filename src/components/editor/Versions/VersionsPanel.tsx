"use client";

import { useVersionesStore } from "@/store/versiones-store";
import { useCollaboratorsStore } from "@/store/collaborators-store";

/** Numero de version con indice descendente (la mas reciente = V{n}). */
function numeroVersion(total: number, index: number): number {
  return total - index;
}

/** Hora corta (y dia si no es hoy) para mostrar cuando se capturo. */
function formatoFecha(fecha: number): string {
  const d = new Date(fecha);
  const hoy = new Date();
  const hora = d.toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (d.toDateString() === hoy.toDateString()) return hora;
  return `${d.toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
  })} ${hora}`;
}

/**
 * Panel flotante de versiones automaticas (solo localStorage).
 * Se abre desde el boton "Versiones" de la barra superior. No hay boton de
 * guardar: cada cambio del diagrama genera una version automaticamente.
 */
export function VersionsPanel() {
  const versiones = useVersionesStore((s) => s.versiones);
  const open = useVersionesStore((s) => s.open);
  const setOpen = useVersionesStore((s) => s.setOpen);
  const restaurar = useVersionesStore((s) => s.restaurar);
  const eliminar = useVersionesStore((s) => s.eliminar);
  const myRole = useCollaboratorsStore((s) => s.myRole);
  const puedeEditar = myRole !== "VIEWER";

  if (!open) return null;

  return (
    <div className="fixed right-4 top-16 z-40 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container shadow-2xl">
      <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-high px-3 py-2">
        <span className="text-sm font-semibold text-on-surface">Versiones</span>
        <span className="rounded-full bg-primary-container px-1.5 py-0.5 text-[10px] text-on-primary-container">
          {versiones.length}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Cerrar versiones"
          className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {versiones.length === 0 ? (
        <div className="px-4 py-6">
          <p className="text-xs leading-relaxed text-on-surface-variant">
            Cada cambio del diagrama se guarda aquí automáticamente
            (solo en este navegador) para poder volver atrás.
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
          {versiones.map((v, i) => (
            <div
              key={v.id}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest p-2"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-on-surface">
                  V{numeroVersion(versiones.length, i)}
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  {formatoFecha(v.fecha)}
                </span>
                <span className="ml-auto text-[10px] text-on-surface-variant">
                  {v.estado?.nodes?.length ?? 0} nodos ·{" "}
                  {v.estado?.edges?.length ?? 0} aristas
                </span>
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  disabled={!puedeEditar}
                  onClick={() => restaurar(v.id)}
                  title={
                    puedeEditar
                      ? "Volver a esta version"
                      : "Los invitados con rol VIEWER no pueden restaurar versiones"
                  }
                  className="flex-1 rounded bg-primary px-2 py-1 text-[11px] font-medium text-on-primary transition-colors hover:bg-primary-fixed disabled:opacity-40"
                >
                  Restaurar
                </button>
                <button
                  type="button"
                  onClick={() => eliminar(v.id)}
                  title="Eliminar esta version de este navegador"
                  className="rounded bg-surface-container-high px-2 py-1 text-[11px] font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-outline-variant bg-surface-container-lowest px-3 py-1.5">
        <p className="text-[10px] text-on-surface-variant">
          Solo en este navegador (localStorage), no se sincroniza ni se guarda
          en la base de datos.
        </p>
      </div>
    </div>
  );
}
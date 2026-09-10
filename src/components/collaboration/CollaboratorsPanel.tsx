"use client";

import { useCollaboratorsStore } from "@/store/collaborators-store";
import { InviteCollaboratorDialog } from "@/components/collaboration/InviteCollaboratorDialog";

/** Etiqueta legible para cada rol. */
const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

/**
 * Panel lateral de colaboradores de un diagrama (UC-2.1 / UC-2.2).
 * - OWNER: lista, invita, cambia rol (EDITOR/VIEWER) y elimina.
 * - EDITOR/VIEWER: solo ve la lista (modo lectura).
 * Despliega el dialogo de invitacion al pulsar "Invitar".
 * @param diagramId - Id del diagrama
 */
export function CollaboratorsPanel({ diagramId }: { diagramId: string }) {
  const collaborators = useCollaboratorsStore((s) => s.collaborators);
  const loading = useCollaboratorsStore((s) => s.loading);
  const isOwner = useCollaboratorsStore((s) => s.isOwner());
  const changeRole = useCollaboratorsStore((s) => s.changeRole);
  const remove = useCollaboratorsStore((s) => s.remove);
  const inviteOpen = useCollaboratorsStore((s) => s.inviteOpen);
  const setInviteOpen = useCollaboratorsStore((s) => s.setInviteOpen);

  return (
    <aside className="flex w-72 flex-col gap-4 border-l border-outline-variant bg-surface-container p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-headline text-sm font-semibold text-on-surface">
          Colaboradores
        </h2>
        {isOwner && (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="rounded-md bg-primary-container px-3 py-1 text-xs font-medium text-on-primary-container transition-colors hover:bg-primary-fixed"
          >
            Invitar
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Cargando...</p>
      ) : collaborators.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          Aun no hay colaboradores.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {collaborators.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-on-surface">
                    {c.username || c.name || c.email}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {c.email}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-md bg-secondary-container px-2 py-0.5 text-xs font-medium text-on-secondary-container">
                  {ROLE_LABEL[c.role] ?? c.role}
                </span>
              </div>

              {isOwner && (
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={c.role}
                    onChange={(e) =>
                      void changeRole(
                        diagramId,
                        c.id,
                        e.target.value as "EDITOR" | "VIEWER",
                      )
                    }
                    aria-label={`Rol de ${c.username || c.name || c.email}`}
                    className="h-8 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-xs text-on-surface outline-none focus:border-primary-container"
                  >
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void remove(diagramId, c.id)}
                    className="rounded-md px-2 py-1 text-xs text-error transition-colors hover:bg-error-container/40"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {inviteOpen && (
        <InviteCollaboratorDialog
          diagramId={diagramId}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </aside>
  );
}
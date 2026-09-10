"use client";

import { useEffect } from "react";
import { useCollaboratorsStore } from "@/store/collaborators-store";
import { InviteCollaboratorDialog } from "@/components/collaboration/InviteCollaboratorDialog";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

interface CollaboratorsModalProps {
  diagramId: string;
  onClose: () => void;
}

/**
 * Modal para gestionar colaboradores del diagrama.
 * OWNER: invita, cambia rol y elimina.
 * EDITOR/VIEWER: solo ve la lista.
 * Al abrirse recarga la lista desde el backend para mostrar datos frescos.
 */
export function CollaboratorsModal({ diagramId, onClose }: CollaboratorsModalProps) {
  const collaborators = useCollaboratorsStore((s) => s.collaborators);
  const loading = useCollaboratorsStore((s) => s.loading);
  const myRole = useCollaboratorsStore((s) => s.myRole);
  const canEdit = useCollaboratorsStore((s) => s.canEdit());
  const load = useCollaboratorsStore((s) => s.load);
  const changeRole = useCollaboratorsStore((s) => s.changeRole);
  const remove = useCollaboratorsStore((s) => s.remove);
  const inviteOpen = useCollaboratorsStore((s) => s.inviteOpen);
  const setInviteOpen = useCollaboratorsStore((s) => s.setInviteOpen);

  // Recarga la lista cada vez que se abre el modal (evita datos obsoletos)
  useEffect(() => {
    void load(diagramId, myRole);
  }, [diagramId, myRole, load]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Contenido del modal */}
      <div className="relative z-10 flex w-full max-w-lg flex-col gap-4 rounded-lg border border-outline-variant bg-surface-container p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-semibold text-on-surface">
            Colaboradores
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Boton invitar */}
        {canEdit && (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="rounded-md bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed"
          >
            + Invitar colaborador
          </button>
        )}

        {/* Lista */}
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

                {canEdit && (
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
      </div>

      {/* Dialogo de invitacion */}
      {inviteOpen && (
        <InviteCollaboratorDialog
          diagramId={diagramId}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  );
}

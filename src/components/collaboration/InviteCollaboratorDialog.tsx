"use client";

import { useState } from "react";
import { useCollaboratorsStore } from "@/store/collaborators-store";
import type { CollaboratorRole } from "@/types";

/**
 * Dialogo para invitar a un colaborador por username o email a un diagrama.
 * Asigna el rol por defecto VIEWER; el owner puede cambiarlo a EDITOR.
 * Solo puede abrirse cuando el usuario autenticado es el OWNER del diagrama.
 * El campo acepta tanto username como email para buscar al usuario.
 * @param diagramId - Id del diagrama
 * @param onClose - Callback al cerrar el dialogo
 */
export function InviteCollaboratorDialog({
  diagramId,
  onClose,
}: {
  diagramId: string;
  onClose: () => void;
}) {
  const invite = useCollaboratorsStore((s) => s.invite);
  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("VIEWER");
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  /**
   * Envia la invitacion. Muestra el error del backend (404 usuario no encontrado, 400, 403).
   * @param e - Evento del formulario
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError("El usuario o email es obligatorio");
      return;
    }

    setInviting(true);
    try {
      await invite(diagramId, identifier.trim(), role);
      setIdentifier("");
      setRole("VIEWER");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrio un error");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 font-headline text-lg font-semibold text-on-surface">
          Invitar colaborador
        </h2>
        <p className="mb-5 text-sm text-on-surface-variant">
          Solo el owner del diagrama puede invitar. Se busca por username o email.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-identifier" className="text-sm font-medium text-on-surface">
              Usuario o email
            </label>
            <input
              id="invite-identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
              className="h-11 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container"
              placeholder="username o email@ejemplo.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-role" className="text-sm font-medium text-on-surface">
              Rol
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as CollaboratorRole)}
              className="h-11 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary-container focus:ring-1 focus:ring-primary-container"
            >
              <option value="VIEWER">VIEWER (solo lectura)</option>
              <option value="EDITOR">EDITOR (puede editar)</option>
            </select>
          </div>

          {error && <span className="text-xs text-error">{error}</span>}

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-md px-4 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="h-10 rounded-md bg-primary-container px-4 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed disabled:opacity-50"
            >
              {inviting ? "Invitando..." : "Invitar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

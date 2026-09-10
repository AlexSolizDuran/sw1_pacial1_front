"use client";

import { create } from "zustand";
import {
  inviteCollaborator,
  listCollaborators,
  removeCollaborator,
  updateCollaboratorRole,
} from "@/lib/collaborators";
import type { Collaborator, CollaboratorRole } from "@/types";

/**
 * Estado global de los colaboradores de un diagrama.
 * Expone el listado, la invitacion (por defecto VIEWER), el cambio de rol y
 * la eliminacion. Solo el OWNER del diagrama gestiona estas acciones; para
 * el resto la UI se muestra en modo solo lectura.
 */
interface CollaboratorsState {
  /** Colaboradores del diagrama actual (no incluye al OWNER). */
  collaborators: Collaborator[];
  /** Rol del usuario autenticado en el diagrama. */
  myRole: CollaboratorRole | null;
  /** True mientras se cargan los colaboradores. */
  loading: boolean;
  /** True si el modal de invitacion esta abierto. */
  inviteOpen: boolean;
  /** True si el usuario autenticado es el OWNER del diagrama. */
  isOwner: () => boolean;
  /** True si el usuario puede editar (OWNER o EDITOR; no VIEWER). */
  canEdit: () => boolean;
  /** Carga los colaboradores y el rol del usuario (GET .../collaborators). */
  load: (diagramId: string, myRole: CollaboratorRole | null) => Promise<void>;
  /** Invita a un usuario por email (POST). @throws Error con mensaje. */
  invite: (diagramId: string, email: string, role: CollaboratorRole) => Promise<void>;
  /** Cambia el rol de un colaborador (PATCH). */
  changeRole: (diagramId: string, id: string, role: CollaboratorRole) => Promise<void>;
  /** Elimina a un colaborador (DELETE). */
  remove: (diagramId: string, id: string) => Promise<void>;
  /** Abre o cierra el modal de invitacion. */
  setInviteOpen: (open: boolean) => void;
}

export const useCollaboratorsStore = create<CollaboratorsState>((set, get) => ({
  collaborators: [],
  myRole: null,
  loading: false,
  inviteOpen: false,

  isOwner: () => get().myRole === "OWNER",
  canEdit: () => get().myRole !== "VIEWER",

  load: async (diagramId, myRole) => {
    set({ myRole, loading: true });
    try {
      // Cualquier participante (owner o colaborador) puede listar
      const collaborators = await listCollaborators(diagramId);
      set({ collaborators, loading: false });
    } catch {
      set({ collaborators: [], loading: false });
    }
  },

  invite: async (diagramId, email, role) => {
    const invited = await inviteCollaborator(diagramId, email, role);
    // Refresca la lista para reflejar el nuevo colaborador
    const collaborators = await listCollaborators(diagramId).catch(() => get().collaborators);
    set({ collaborators });
    set({ inviteOpen: false });
  },

  changeRole: async (diagramId, id, role) => {
    await updateCollaboratorRole(diagramId, id, role);
    set((s) => ({
      collaborators: s.collaborators.map((c) =>
        c.id === id ? { ...c, role } : c,
      ),
    }));
  },

  remove: async (diagramId, id) => {
    await removeCollaborator(diagramId, id);
    set((s) => ({
      collaborators: s.collaborators.filter((c) => c.id !== id),
    }));
  },

  setInviteOpen: (open) => set({ inviteOpen: open }),
}));

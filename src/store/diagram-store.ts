"use client";

import { create } from "zustand";
import {
  apiFetch,
  updateWorkspace,
  deleteWorkspace,
  updateDiagram,
  deleteDiagram,
  reorderDiagrams,
} from "@/lib/api";
import type {
  Diagram,
  DiagramSummary,
  Workspace,
  WorkspaceDetail,
} from "@/types";

/**
 * Estado global de workspaces y diagramas.
 * Maneja la creacion de workspaces, la navegacion a sus diagramas y el
 * listado de diagramas donde el usuario es colaborador.
 */
interface DiagramState {
  /** Lista de workspaces del usuario (propios). */
  workspaces: Workspace[];
  /** Diagramas donde el usuario es colaborador (EDITOR/VIEWER). */
  sharedDiagrams: Diagram[];
  /** True mientras se cargan los datos. */
  loading: boolean;
  /** Carga los workspaces del usuario (GET /workspaces). */
  fetchWorkspaces: () => Promise<void>;
  /** Carga los diagramas compartidos (GET /diagrams/shared). */
  fetchSharedDiagrams: () => Promise<void>;
  /** Crea un workspace (POST /workspaces). */
  createWorkspace: (name: string) => Promise<Workspace>;
  /** Obtiene el detalle de un workspace con sus diagramas (GET /workspaces/:id). */
  fetchWorkspace: (id: string) => Promise<WorkspaceDetail>;
  /** Crea un diagrama dentro de un workspace (POST /.../diagrams). */
  createDiagram: (
    workspaceId: string,
    name: string,
  ) => Promise<Diagram>;
  /** Renombra un workspace (PATCH /workspaces/:id). */
  renameWorkspace: (id: string, name: string) => Promise<void>;
  /** Elimina un workspace (DELETE /workspaces/:id). */
  removeWorkspace: (id: string) => Promise<void>;
  /** Renombra un diagrama (PATCH /diagrams/:id). */
  renameDiagram: (id: string, name: string) => Promise<void>;
  /** Elimina un diagrama (DELETE /diagrams/:id). */
  removeDiagram: (id: string) => Promise<void>;
  /** Reordena los diagramas de un workspace (PUT /.../diagrams/order). */
  reorderDiagramsInWorkspace: (
    workspaceId: string,
    items: Array<{ id: string; position: number }>,
  ) => Promise<void>;
}

export const useDiagramStore = create<DiagramState>((set) => ({
  workspaces: [],
  sharedDiagrams: [],
  loading: true,

  fetchWorkspaces: async () => {
    const workspaces = await apiFetch<Workspace[]>("/workspaces");
    set({ workspaces, loading: false });
  },

  fetchSharedDiagrams: async () => {
    const sharedDiagrams = await apiFetch<Diagram[]>("/diagrams/shared");
    set({ sharedDiagrams });
  },

  createWorkspace: async (name) => {
    const workspace = await apiFetch<Workspace>("/workspaces", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    // Recarga la lista para reflejar el nuevo workspace
    const workspaces = await apiFetch<Workspace[]>("/workspaces");
    set({ workspaces });
    return workspace;
  },

  fetchWorkspace: async (id) => {
    return apiFetch<WorkspaceDetail>(`/workspaces/${id}`);
  },

  createDiagram: async (workspaceId, name) => {
    return apiFetch<Diagram>(
      `/workspaces/${workspaceId}/diagrams`,
      {
        method: "POST",
        body: JSON.stringify({ name }),
      },
    );
  },

  renameWorkspace: async (id, name) => {
    await updateWorkspace(id, name);
    const workspaces = await apiFetch<Workspace[]>("/workspaces");
    set({ workspaces });
  },

  removeWorkspace: async (id) => {
    await deleteWorkspace(id);
    const workspaces = await apiFetch<Workspace[]>("/workspaces");
    set({ workspaces });
  },

  renameDiagram: async (id, name) => {
    await updateDiagram(id, name);
  },

  removeDiagram: async (id) => {
    await deleteDiagram(id);
  },

  reorderDiagramsInWorkspace: async (workspaceId, items) => {
    await reorderDiagrams(workspaceId, items);
  },
}));

// Re-export para comodidad en el tipo de las funciones
export type { DiagramSummary };

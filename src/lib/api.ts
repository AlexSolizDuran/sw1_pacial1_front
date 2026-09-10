/** URL base del backend NestJS. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

import type { Diagram, Workspace, WorkspaceDetail } from "@/types";
import type { DiagramState } from "@/types/diagram";

/**
 * Cliente fetch con las opciones por defecto.
 * Envia credentials para que el backend lea la cookie HttpOnly del JWT.
 * @param path - Ruta relativa bajo /api (ej: "/auth/login")
 * @param init - Opciones adicionales de fetch
 * @returns La respuesta como JSON tipado
 * @throws Error con el mensaje del backend si la peticion falla
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!res.ok) {
    // Extrae el mensaje de error enviado por NestJS (message puede ser string o array)
    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message ?? "Error desconocido";
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

/** Perfil publico del usuario autenticado. */
export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
}

/** Campos editables del perfil de usuario. */
export interface UpdateProfilePayload {
  name?: string;
  username?: string;
  currentPassword?: string;
  newPassword?: string;
}

/** Actualiza el perfil del usuario (PATCH /auth/profile). */
export function updateProfile(
  payload: UpdateProfilePayload,
): Promise<User> {
  return apiFetch<User>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Diagrama tal como lo devuelve GET /diagrams/:id (incluye el estado del lienzo). */
export interface DiagramWithState extends Diagram {
  /** Estado observable del lienzo (nodos y aristas). */
  reactFlowState: DiagramState | null;
}

/**
 * Obtiene un diagrama con su estado del lienzo (GET /diagrams/:id).
 * @param id - Id del diagrama
 * @returns El diagrama con su reactFlowState
 */
export function getDiagram(id: string): Promise<DiagramWithState> {
  return apiFetch<DiagramWithState>(`/diagrams/${id}`);
}

/**
 * Persiste el estado del lienzo (PUT /diagrams/:id/state).
 * @param id - Id del diagrama
 * @param reactFlowState - Estado { nodes, edges } a guardar
 * @returns El diagrama actualizado
 */
export function saveDiagramState(
  id: string,
  reactFlowState: DiagramState,
): Promise<Diagram> {
  return apiFetch<Diagram>(`/diagrams/${id}/state`, {
    method: "PUT",
    body: JSON.stringify({ reactFlowState }),
  });
}

// --- Workspaces ---

/** Renombra un workspace (PATCH /workspaces/:id). */
export function updateWorkspace(
  id: string,
  name: string,
): Promise<Workspace> {
  return apiFetch<Workspace>(`/workspaces/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

/** Elimina un workspace (DELETE /workspaces/:id). */
export function deleteWorkspace(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/workspaces/${id}`, {
    method: "DELETE",
  });
}

// --- Diagramas ---

/** Renombra un diagrama (PATCH /diagrams/:id). */
export function updateDiagram(
  id: string,
  name: string,
): Promise<Diagram> {
  return apiFetch<Diagram>(`/diagrams/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

/** Elimina un diagrama (DELETE /diagrams/:id). */
export function deleteDiagram(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/diagrams/${id}`, {
    method: "DELETE",
  });
}

/** Reordena los diagramas de un workspace (PUT /workspaces/:id/diagrams/order). */
export function reorderDiagrams(
  workspaceId: string,
  items: Array<{ id: string; position: number }>,
): Promise<Diagram[]> {
  return apiFetch<Diagram[]>(
    `/workspaces/${workspaceId}/diagrams/order`,
    {
      method: "PUT",
      body: JSON.stringify({ items }),
    },
  );
}

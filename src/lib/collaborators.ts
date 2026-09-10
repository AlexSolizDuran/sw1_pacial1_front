import { apiFetch } from "@/lib/api";
import type { Collaborator } from "@/types";

/**
 * Cliente de los endpoints REST de colaboradores de un diagrama.
 * Todos exigen JWT y solo el OWNER puede invitar/cambiar rol/eliminar.
 */

/**
 * Lista los colaboradores de un diagrama (GET /diagrams/:id/collaborators).
 * Debe llamarlo el OWNER o cualquier colaborador del diagrama.
 * @param diagramId - Id del diagrama
 * @returns Lista de colaboradores con su rol
 */
export function listCollaborators(
  diagramId: string,
): Promise<Collaborator[]> {
  return apiFetch<Collaborator[]>(`/diagrams/${diagramId}/collaborators`);
}

/**
 * Invita a un usuario (por username o email) a colaborar (POST .../collaborators).
 * El rol por defecto es VIEWER (solo lectura); puede ser EDITOR (editar).
 * El backend espera el campo "identifier" (username o email), no "email".
 * @param diagramId - Id del diagrama
 * @param identifier - Username o email del usuario invitado
 * @param role - Rol a asignar (por defecto VIEWER)
 * @returns El colaborador creado/actualizado
 */
export function inviteCollaborator(
  diagramId: string,
  identifier: string,
  role?: Collaborator["role"],
): Promise<Collaborator> {
  return apiFetch<Collaborator>(`/diagrams/${diagramId}/collaborators`, {
    method: "POST",
    body: JSON.stringify({ identifier, role }),
  });
}

/**
 * Cambia el permiso (rol) de un colaborador (PATCH .../collaborators/:id).
 * Solo puede hacerlo el OWNER del diagrama.
 * @param diagramId - Id del diagrama
 * @param collaboratorId - Id del colaborador a modificar
 * @param role - Nuevo rol (EDITOR | VIEWER)
 * @returns El colaborador con su nuevo rol
 */
export function updateCollaboratorRole(
  diagramId: string,
  collaboratorId: string,
  role: Collaborator["role"],
): Promise<Collaborator> {
  return apiFetch<Collaborator>(
    `/diagrams/${diagramId}/collaborators/${collaboratorId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
  );
}

/**
 * Elimina a un colaborador de un diagrama (DELETE .../collaborators/:id).
 * Solo puede hacerlo el OWNER del diagrama.
 * @param diagramId - Id del diagrama
 * @param collaboratorId - Id del colaborador a eliminar
 * @returns Mensaje de confirmacion del backend
 */
export function removeCollaborator(
  diagramId: string,
  collaboratorId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(
    `/diagrams/${diagramId}/collaborators/${collaboratorId}`,
    { method: "DELETE" },
  );
}

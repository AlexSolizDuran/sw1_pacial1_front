/**
 * Tipos publicos del dominio (workspaces, diagramas).
 * Se corresponden con las respuestas del backend NestJS.
 */

/** Espacio de trabajo (respuesta de GET /workspaces). */
export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  /** Cantidad de diagramas (solo en el listado). */
  diagramCount?: number;
}

/** Workspace con sus diagramas (respuesta de GET /workspaces/:id). */
export interface WorkspaceDetail extends Workspace {
  diagrams: DiagramSummary[];
}

/** Resumen de un diagrama dentro de un workspace. */
export interface DiagramSummary {
  id: string;
  name: string;
  lastModified: string;
  /** Posicion en el orden del workspace (CU-1.3). */
  position: number;
  /** Grupo de organizacion (CU-1.3, null = sin grupo). */
  group: string | null;
}

/** Diagrama completo (respuesta de los endpoints de diagramas). */
export interface Diagram {
  id: string;
  name: string;
  position: number;
  /** Grupo de organizacion (CU-1.3, null = sin grupo). */
  group: string | null;
  lastModified: string;
  createdAt: string;
  createdById: string;
  /** Rol del usuario autenticado en este diagrama (OWNER/EDITOR/VIEWER). */
  role?: string;
  /** Nombre del workspace solo presente en diagramas compartidos. */
  workspaceName?: string;
  /** Id del workspace (presente en diagramas compartidos, para navegar). */
  workspaceId?: string;
}

/** Rol de un usuario dentro de un diagrama. */
export type CollaboratorRole = "OWNER" | "EDITOR" | "VIEWER";

/** Colaborador de un diagrama (respuesta de los endpoints de colaboradores). */
export interface Collaborator {
  id: string;
  username: string;
  name: string;
  email: string;
  role: CollaboratorRole;
  /** Solo presente en el listado (pendiente del diagrama). */
  assignedAt?: string;
}
